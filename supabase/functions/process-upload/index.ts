import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { extractText } from "npm:unpdf@1.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubmissionMetadata {
  title: string;
  format_type: string;
  genre: string;
  logline: string;
  synopsis: string;
  language: string;
  secondary_genre?: string;
  themes?: string[];
  primary_setting?: string;
  time_period?: string;
  country?: string;
  target_audience?: string;
  budget_range?: string;
  tags?: string[];
}

type TitlePageValidation = "valid" | "title_mismatch" | "identifying_information" | "unreadable";

interface ProcessResult {
  success: boolean;
  screenplayId?: string;
  pageCount?: number;
  validation?: TitlePageValidation;
  error?: string;
}

function json(body: ProcessResult | { error: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normaliseTitle(value: string) {
  return value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req: Request) => {

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth header" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: eligibility, error: eligibilityError } = await supabase.rpc("check_upload_eligibility", { p_user_id: user.id });
    if (eligibilityError || eligibility === "none") {
      return json({ success: false, error: "No upload credits available. Earn contribution points by reading and reviewing screenplays to unlock another upload." });
    }

    const formData = await req.formData();
    const fileValue = formData.get("file");
    const metadataValue = formData.get("metadata");
    if (!(fileValue instanceof File) || typeof metadataValue !== "string") return json({ error: "Missing file or metadata" }, 400);

    let metadata: SubmissionMetadata;
    try {
      metadata = JSON.parse(metadataValue) as SubmissionMetadata;
    } catch {
      return json({ success: false, error: "The screenplay details could not be read." });
    }

    const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
    const logline = typeof metadata.logline === "string" ? metadata.logline.trim() : "";
    const synopsis = typeof metadata.synopsis === "string" ? metadata.synopsis.trim() : "";
    if (!title || !metadata.format_type || !metadata.genre || !metadata.language) return json({ success: false, error: "Complete all required screenplay details." });
    if (logline.length < 1 || logline.length > 200) return json({ success: false, error: "The logline must be between 1 and 200 characters." });
    if (synopsis.length < 250 || synopsis.length > 1500) return json({ success: false, error: "The short synopsis must be between 250 and 1,500 characters." });

    const file = fileValue;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return json({ success: false, error: "Only PDF files are accepted." });
    if (file.size > 25 * 1024 * 1024) return json({ success: false, error: "The PDF must be 25MB or smaller." });

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ success: false, error: "This file is not a valid PDF." });

    let pageCount = 0;
    let pageOneText = "";
    try {
      const textResult = await extractText(bytes, { mergePages: false });
      pageCount = textResult.totalPages;
      const pages = textResult.text as unknown;
      pageOneText = Array.isArray(pages) && typeof pages[0] === "string" ? pages[0] : "";
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      if (/password|encrypt|security/i.test(message)) return json({ success: false, validation: "unreadable", error: "Title page could not be verified. Scrinit could not verify the first page of this PDF. Please upload a properly formatted, readable screenplay PDF." });
      return json({ success: false, validation: "unreadable", error: "Title page could not be verified. Scrinit could not verify the first page of this PDF. Please upload a properly formatted, readable screenplay PDF." });
    }

    if (pageCount < 1) return json({ success: false, validation: "unreadable", error: "Title page could not be verified. Scrinit could not verify the first page of this PDF. Please upload a properly formatted, readable screenplay PDF." });
    if (pageCount > 500) return json({ success: false, error: "The PDF cannot exceed 500 pages." });

    const normalisedMetadataTitle = normaliseTitle(title);
    const normalisedPageOne = normaliseTitle(pageOneText);
    if (!normalisedPageOne) {
      return json({ success: false, pageCount, validation: "unreadable", error: "Title page could not be verified. Scrinit could not verify the first page of this PDF. Please upload a properly formatted, readable screenplay PDF." });
    }
    if (normalisedPageOne !== normalisedMetadataTitle) {
      const containsTitle = ` ${normalisedPageOne} `.includes(` ${normalisedMetadataTitle} `);
      if (!containsTitle) {
        return json({ success: false, pageCount, validation: "title_mismatch", error: "Title page does not match. The title on the first page must match the title entered above. Please check the title and upload the screenplay again." });
      }
      return json({ success: false, pageCount, validation: "identifying_information", error: "Title page contains identifying information. The first page must contain only the screenplay title. Remove any writer name, contact details or other identifying information and upload the screenplay again." });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("screenplays").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) return json({ success: false, error: `Upload failed: ${uploadError.message}` });

    const { data: screenplay, error: insertError } = await supabase
      .from("screenplays")
      .insert({
        writer_id: user.id,
        title,
        genre: metadata.genre,
        logline,
        synopsis,
        content: [],
        page_count: pageCount,
        status: "draft",
        cover_color: "amber",
        tags: Array.isArray(metadata.tags) ? metadata.tags.slice(0, 10) : [],
        published_at: null,
        original_pdf_path: path,
        anonymous_pdf_path: path,
        visibility: "private",
        format_type: metadata.format_type,
        secondary_genre: metadata.secondary_genre || null,
        budget_range: metadata.budget_range || null,
        themes: Array.isArray(metadata.themes) ? metadata.themes : [],
        primary_setting: metadata.primary_setting || null,
        time_period: metadata.time_period || null,
        tone: null,
        target_audience: metadata.target_audience || null,
        sanitisation_notes: null,
        country: metadata.country || null,
        language: metadata.language,
      })
      .select("id")
      .single();

    if (insertError || !screenplay) {
      await supabase.storage.from("screenplays").remove([path]);
      return json({ success: false, error: `Failed to create screenplay record: ${insertError?.message ?? "unknown error"}` });
    }

    return json({ success: true, screenplayId: screenplay.id, pageCount, validation: "valid" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

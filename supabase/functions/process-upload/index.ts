import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { extractText } from "npm:unpdf@1.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessResult {
  success: boolean;
  screenplayId?: string;
  pageCount?: number;
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: eligibility, error: eligError } = await supabase.rpc("check_upload_eligibility", { p_user_id: user.id });
    if (eligError || eligibility === "none") {
      return new Response(JSON.stringify({
        success: false,
        error: "No upload credits available. Earn contribution points by reading and reviewing screenplays to unlock another upload.",
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const path = formData.get("path") as string;

    if (!file || !path) {
      return new Response(JSON.stringify({ error: "Missing file or path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Only PDF files are accepted.",
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      return new Response(JSON.stringify({
        success: false,
        error: `File exceeds maximum size of 25MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let pageCount = 0;

    try {
      const textResult = await extractText(bytes, { mergePages: true });
      pageCount = textResult.totalPages;
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? `${parseErr.name}: ${parseErr.message}` : String(parseErr);
      if (/password|encrypt|security/i.test(msg)) {
        return new Response(JSON.stringify({
          success: false,
          error: "This PDF is password-protected. Please remove the password and upload again.",
        } as ProcessResult), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        success: false,
        error: "This file is not a valid PDF. It may be corrupted or in an unsupported format.",
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pageCount < 1) {
      return new Response(JSON.stringify({
        success: false,
        error: "The PDF appears to have no pages. The file may be corrupt.",
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pageCount > 500) {
      return new Response(JSON.stringify({
        success: false,
        error: `This PDF has ${pageCount} pages. The maximum is 500 pages.`,
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: uploadError } = await supabase.storage
      .from("screenplays")
      .upload(path, file, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      return new Response(JSON.stringify({
        success: false,
        error: `Upload failed: ${uploadError.message}`,
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: screenplayRow, error: insertError } = await supabase
      .from("screenplays")
      .insert({
        writer_id: user.id,
        title: "Untitled",
        genre: "Drama",
        logline: "No logline provided.",
        content: [],
        page_count: pageCount,
        status: "draft",
        cover_color: "amber",
        tags: [],
        published_at: null,
        original_pdf_path: path,
        anonymous_pdf_path: path,
        visibility: "private",
        format_type: null,
        budget_range: null,
        themes: [],
        primary_setting: null,
        time_period: null,
        tone: null,
        target_audience: null,
        sanitisation_notes: null,
        country: null,
        language: "en",
      })
      .select("id")
      .single();

    if (insertError || !screenplayRow) {
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create screenplay record: ${insertError?.message ?? "unknown error"}`,
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: ProcessResult = {
      success: true,
      screenplayId: screenplayRow.id,
      pageCount,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

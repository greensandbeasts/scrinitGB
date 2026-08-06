import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import * as pdfjs from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProcessResult {
  success: boolean;
  pageCount: number;
  title: string | null;
  metadata: {
    title: string | null;
    logline: string | null;
    synopsis: string | null;
    genre: string | null;
    secondaryGenre: string | null;
    formatType: string | null;
    budgetRange: string | null;
    themes: string[];
    primarySetting: string | null;
    timePeriod: string | null;
    tone: string | null;
    targetAudience: string | null;
    tags: string[];
  };
  sanitisation: {
    hasIdentifyingInfo: boolean;
    notes: string[];
  };
  error?: string;
}

interface PdfInfo {
  pageCount: number;
  extractedText: string;
  title: string | null;
  encrypted: boolean;
}

async function parsePdf(bytes: Uint8Array): Promise<PdfInfo> {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;

  let extractedText = "";
  const maxPagesToExtract = Math.min(pageCount, 30);
  for (let i = 1; i <= maxPagesToExtract; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");
    extractedText += pageText + "\n";
  }
  extractedText = extractedText.slice(0, 20000);

  let title: string | null = null;
  try {
    const meta = await pdfDoc.getMetadata();
    const info = meta.info as Record<string, unknown> | undefined;
    const rawTitle = info?.Title as string | undefined;
    if (rawTitle && rawTitle.trim()) {
      title = rawTitle.trim();
    }
  } catch {
    // Metadata is best-effort
  }

  if (!title && extractedText.length > 0) {
    const firstChunks = extractedText.split("\n").filter((l) => l.trim().length > 3).slice(0, 5).join(" ");
    const titleMatch = firstChunks.match(/^([A-Z][A-Za-z0-9\s:'\-–—!?]{3,80})/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
  }

  await pdfDoc.destroy();

  return { pageCount, extractedText, title, encrypted: false };
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

    // Check upload credit eligibility before processing
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

    // Validate file type
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return new Response(JSON.stringify({
        success: false,
        error: "Only PDF files are accepted.",
      } as ProcessResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file size (25MB max)
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

    // Parse and validate the PDF using pdfjs-dist
    let pdfInfo: PdfInfo;
    try {
      pdfInfo = await parsePdf(bytes);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
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

    const pageCount = pdfInfo.pageCount;
    const extractedText = pdfInfo.extractedText;
    const title = pdfInfo.title;

    // Validate page count
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

    // Detect identifying information
    const sanitisationNotes: string[] = [];
    const lowerText = extractedText.toLowerCase();

    const patterns = [
      { regex: /[\w.+-]+@[\w-]+\.[\w.-]+/gi, label: "email addresses" },
      { regex: /(?:phone|tel|cell|mobile)[:\s]+[\d\s()+\-]{7,}/gi, label: "phone numbers" },
      { regex: /(?:written by|author|writer)[:\s]+[A-Z][a-z]+\s+[A-Z][a-z]+/g, label: "writer names" },
      { regex: /(?:agent|agency|management|represented by)[:\s]+[A-Z][\w\s&.]+/gi, label: "representation info" },
      { regex: /(?:copyright|©|all rights reserved)[:\s\w\d.,]+/gi, label: "copyright notices" },
      { regex: /(?:registered|wga|wgaw|wgae)[:\s#\d]+/gi, label: "registration numbers" },
      { regex: /https?:\/\/[^\s]+/gi, label: "websites" },
      { regex: /(?:linkedin|twitter|instagram|facebook)\.com\/[\w]+/gi, label: "social media links" },
    ];

    for (const { regex, label } of patterns) {
      if (regex.test(extractedText)) {
        sanitisationNotes.push(label);
        regex.lastIndex = 0;
      }
    }

    const hasIdentifyingInfo = sanitisationNotes.length > 0;

    // Infer metadata from extracted text
    const genreKeywords: Record<string, string[]> = {
      "Thriller": ["thriller", "suspense", "tension", "danger", "escape", "chase"],
      "Drama": ["drama", "emotional", "family", "relationship", "struggle"],
      "Science Fiction": ["space", "future", "alien", "robot", "dystopia", "cyber", "planet"],
      "Horror": ["horror", "scary", "ghost", "demon", "blood", "fear", "monster"],
      "Comedy": ["comedy", "funny", "humor", "joke", "laugh"],
      "Action": ["action", "fight", "explosion", "mission", "combat", "weapon"],
      "Mystery": ["mystery", "detective", "investigation", "clue", "murder"],
      "Adventure": ["adventure", "journey", "quest", "explore", "treasure"],
      "Fantasy": ["fantasy", "magic", "dragon", "kingdom", "wizard", "spell"],
      "Romance": ["romance", "love", "relationship", "heart"],
    };

    let genre: string | null = null;
    for (const [g, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) {
        genre = g;
        break;
      }
    }

    // Infer format from page count
    let formatType: string | null = null;
    if (pageCount <= 15) formatType = "Short";
    else if (pageCount <= 45) formatType = "TV Pilot";
    else if (pageCount <= 130) formatType = "Feature";
    else formatType = "Feature";

    // Infer budget range from keywords
    let budgetRange: string | null = null;
    if (/\b(explosion|space|war|battle|army|navy|city|destroy|crash|helicopter|plane)\b/i.test(extractedText)) {
      budgetRange = "High ($50M+)";
    } else if (/\b(car|house|office|restaurant|street|hotel)\b/i.test(extractedText)) {
      budgetRange = "Medium ($5M-$50M)";
    } else if (pageCount <= 15) {
      budgetRange = "Low (Under $5M)";
    } else {
      budgetRange = "Medium ($5M-$50M)";
    }

    // Infer tone
    let tone: string | null = null;
    const toneKeywords: Record<string, string[]> = {
      "Dark": ["dark", "bleak", "grim", "brutal", "violent"],
      "Light-hearted": ["fun", "light", "cheerful", "warm", "sweet"],
      "Tense": ["tense", "suspenseful", "edge", "nervous", "anxiety"],
      "Emotional": ["emotional", "heartfelt", "moving", "tear", "cry"],
      "Gritty": ["gritty", "raw", "harsh", "real"],
    };
    for (const [t, keywords] of Object.entries(toneKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) {
        tone = t;
        break;
      }
    }

    // Infer themes
    const themeKeywords: Record<string, string[]> = {
      "Identity": ["identity", "self", "who am i", "belong"],
      "Family": ["family", "father", "mother", "son", "daughter", "brother", "sister"],
      "Power": ["power", "control", "authority", "rule", "king"],
      "Survival": ["survive", "survival", "alive", "rescue", "escape"],
      "Love": ["love", "romance", "heart", "passion"],
      "Justice": ["justice", "revenge", "right", "wrong", "law"],
      "Freedom": ["freedom", "free", "liberty", "escape", "independent"],
    };
    const themes: string[] = [];
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(k => lowerText.includes(k))) {
        themes.push(theme);
      }
    }

    // Infer primary setting
    let primarySetting: string | null = null;
    const settingMatch = extractedText.match(/(?:INT|EXT)\.?\s+([A-Z][A-Z\s\-]+?)(?:\s*[-–])/);
    if (settingMatch) {
      primarySetting = settingMatch[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }

    // Infer time period
    let timePeriod: string | null = null;
    if (/\b(19[0-9]{2}|18[0-9]{2}|17[0-9]{2}|16[0-9]{2}|medieval|ancient|future|present day|modern)\b/i.test(extractedText)) {
      const tpMatch = extractedText.match(/\b(19[0-9]{2}|18[0-9]{2}|17[0-9]{2}|16[0-9]{2}|medieval|ancient|future|present day|modern)\b/i);
      if (tpMatch) timePeriod = tpMatch[1];
    }

    // Infer target audience
    let targetAudience: string | null = null;
    if (/\b(child|kid|teen|young|school)\b/i.test(extractedText)) {
      targetAudience = "Young Adult";
    } else if (/\b(adult|family)\b/i.test(extractedText)) {
      targetAudience = "General";
    } else {
      targetAudience = "Adult";
    }

    // Upload the file to storage
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

    const result: ProcessResult = {
      success: true,
      pageCount,
      title,
      metadata: {
        title,
        logline: null,
        synopsis: null,
        genre,
        secondaryGenre: null,
        formatType,
        budgetRange,
        themes: themes.slice(0, 5),
        primarySetting,
        timePeriod,
        tone,
        targetAudience,
        tags: [],
      },
      sanitisation: {
        hasIdentifyingInfo,
        notes: sanitisationNotes,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

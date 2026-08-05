import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const url = new URL(req.url);
    const screenplayId = url.searchParams.get("screenplayId");

    if (!screenplayId) {
      return new Response(JSON.stringify({ error: "Missing screenplayId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the screenplay record
    const { data: screenplay, error: spError } = await supabase
      .from("screenplays")
      .select("id, writer_id, anonymous_pdf_path, original_pdf_path, visibility, industry_qualified, industry_access, status")
      .eq("id", screenplayId)
      .maybeSingle();

    if (spError || !screenplay) {
      return new Response(JSON.stringify({ error: "Screenplay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which PDF to serve
    const isWriter = screenplay.writer_id === user.id;
    const isAdminRes = await supabase.rpc("is_admin");
    const isAdmin = !!isAdminRes.data;

    // Only writers and admins get the original PDF
    // Readers and industry always get the anonymous copy
    let pdfPath: string;
    let bucket: string;

    if (isWriter || isAdmin) {
      // Writers and admins can access the original
      if (screenplay.original_pdf_path) {
        bucket = "screenplays";
        pdfPath = screenplay.original_pdf_path;
      } else if (screenplay.anonymous_pdf_path) {
        bucket = "anonymous-copies";
        pdfPath = screenplay.anonymous_pdf_path;
      } else {
        return new Response(JSON.stringify({ error: "No PDF available" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Readers and industry get the anonymous copy
      if (!screenplay.anonymous_pdf_path) {
        return new Response(JSON.stringify({ error: "No anonymous copy available" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check access: industry users can only read qualified screenplays
      if (screenplay.visibility === "industry_qualified" || screenplay.industry_qualified) {
        // Check if user has industry role
        const { data: hasIndustry } = await supabase.rpc("has_role", {
          p_user_id: user.id,
          p_role: "industry",
        });
        if (!hasIndustry) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (screenplay.visibility === "readers_only") {
        // Check if user is a reader with an assignment
        const { data: assignment } = await supabase
          .from("assignments")
          .select("id")
          .eq("screenplay_id", screenplayId)
          .eq("reader_id", user.id)
          .maybeSingle();
        if (!assignment) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      bucket = "anonymous-copies";
      pdfPath = screenplay.anonymous_pdf_path;
    }

    // Download the file from storage using service role client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from(bucket)
      .download(pdfPath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to retrieve PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the PDF with appropriate headers
    // No download headers - prevent downloads
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

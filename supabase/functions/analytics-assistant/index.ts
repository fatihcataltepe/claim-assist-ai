import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all claims data for context
    const { data: claims, error: claimsError } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (claimsError) {
      console.error("Error fetching claims:", claimsError);
      throw new Error("Failed to fetch claims data");
    }

    // Calculate analytics context
    const totalClaims = claims?.length || 0;
    const activeClaims = claims?.filter(c => c.status !== "completed").length || 0;
    const completedClaims = claims?.filter(c => c.status === "completed").length || 0;
    const coveredClaims = claims?.filter(c => c.is_covered === true).length || 0;
    const notCoveredClaims = claims?.filter(c => c.is_covered === false).length || 0;
    
    // Status breakdown
    const statusBreakdown = claims?.reduce((acc: Record<string, number>, claim) => {
      const status = claim.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Coverage types breakdown
    const roadsideAssistance = claims?.filter(c => c.roadside_assistance === true).length || 0;
    const towingCoverage = claims?.filter(c => c.towing_coverage === true).length || 0;
    const rentalCarCoverage = claims?.filter(c => c.rental_car_coverage === true).length || 0;
    const transportCoverage = claims?.filter(c => c.transport_coverage === true).length || 0;

    // Calculate average resolution time
    const completedWithTimes = claims?.filter(c => c.status === "completed" && c.created_at && c.updated_at) || [];
    const avgResolutionMinutes = completedWithTimes.length > 0
      ? Math.round(completedWithTimes.reduce((sum, claim) => {
          const created = new Date(claim.created_at).getTime();
          const updated = new Date(claim.updated_at).getTime();
          return sum + (updated - created) / (1000 * 60);
        }, 0) / completedWithTimes.length)
      : 0;

    // Recent claims summary (last 5)
    const recentClaims = claims?.slice(0, 5).map(c => ({
      driver: c.driver_name,
      status: c.status,
      covered: c.is_covered,
      location: c.location,
      created: c.created_at
    })) || [];

    const systemPrompt = `You are an AI analytics assistant for an insurance claims dashboard. You help admins understand claims data, identify trends, and make data-driven decisions.

CURRENT CLAIMS DATA:
- Total Claims: ${totalClaims}
- Active Claims: ${activeClaims}
- Completed Claims: ${completedClaims}
- Covered Claims: ${coveredClaims}
- Not Covered Claims: ${notCoveredClaims}
- Coverage Rate: ${totalClaims > 0 ? Math.round((coveredClaims / totalClaims) * 100) : 0}%
- Average Resolution Time: ${avgResolutionMinutes} minutes

STATUS BREAKDOWN:
${Object.entries(statusBreakdown).map(([status, count]) => `- ${status}: ${count}`).join("\n")}

COVERAGE TYPES:
- Roadside Assistance: ${roadsideAssistance} claims
- Towing Coverage: ${towingCoverage} claims
- Rental Car Coverage: ${rentalCarCoverage} claims
- Transport Coverage: ${transportCoverage} claims

RECENT CLAIMS:
${recentClaims.map(c => `- ${c.driver || "Unknown"}: ${c.status}, ${c.covered ? "Covered" : "Not Covered"}, ${c.location || "No location"}`).join("\n")}

RAW CLAIMS DATA (for detailed queries):
${JSON.stringify(claims?.slice(0, 20), null, 2)}

Guidelines:
- Be concise and helpful
- Provide specific numbers and percentages when asked
- Suggest actionable insights when relevant
- If asked about specific claims, search through the data provided
- Format numbers nicely (use commas for thousands, percentages where appropriate)
- If you can't answer something from the data, say so clearly`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    console.log("Calling Lovable AI with message:", message);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    console.log("AI response received successfully");

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analytics assistant error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

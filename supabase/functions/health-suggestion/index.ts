// AteWell.AI - Health Suggestion Edge Function
// Proxies requests to OpenRouter API, keeping the API key server-side
import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured on server" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { itemName, nutritionContext } = await req.json();

    if (!itemName) {
      return new Response(
        JSON.stringify({ error: "itemName is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nutritionInfo = nutritionContext
      ? `\n\nHere is the actual nutrition data for this product:\n${nutritionContext}\n\nUse this data to give a more specific and accurate recommendation.`
      : "";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://atewell.ai",
          "X-Title": "AteWell.AI",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "You are a nutrition expert that provides brief, helpful suggestions for healthier food alternatives. Format your response with the alternative on the first line and the explanation on the second line. If nutrition data is provided, reference specific nutritional concerns (e.g., high sugar, high sodium, ultra-processed) in your recommendation.",
            },
            {
              role: "user",
              content: `Suggest a healthier grocery alternative for "${itemName}" and explain why it's healthier in one sentence.${nutritionInfo}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", errorText);
      return new Response(
        JSON.stringify({ error: `OpenRouter error: ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content;

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: "No suggestion returned" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the suggestion into healthSuggestion + reason
    const lines = suggestion.split("\n").filter((l: string) => l.trim() !== "");
    const healthSuggestion = lines[0]?.trim();
    const suggestionReason =
      lines.length > 1 ? lines.slice(1).join(" ").trim() : "";

    console.log(`✅ ${itemName} → ${healthSuggestion}`);

    return new Response(
      JSON.stringify({ healthSuggestion, suggestionReason }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

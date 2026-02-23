import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: missing API key" });
  }

  try {
    const { itemName, nutritionContext } = req.body;

    if (!itemName) {
      return res.status(400).json({ error: "itemName is required" });
    }

    const nutritionInfo = nutritionContext
      ? `\n\nHere is the actual nutrition data for this product:\n${nutritionContext}\n\nUse this data to give a more specific and accurate recommendation.`
      : "";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `OpenRouter error: ${errorText}` });
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content;

    if (!suggestion) {
      return res.status(500).json({ error: "No suggestion returned" });
    }

    // Parse the suggestion into alternative and reason
    const lines = suggestion.split("\n").filter((line: string) => line.trim() !== "");
    const healthSuggestion = lines[0]?.trim();
    const suggestionReason = lines.length > 1 ? lines.slice(1).join(" ").trim() : "";

    return res.status(200).json({ healthSuggestion, suggestionReason });
  } catch (error) {
    console.error("Health suggestion error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

const http = require("http");
const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex !== -1) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

const PORT = 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY not found in .env.local");
  process.exit(1);
}

console.log("✅ OpenRouter API key loaded");

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/health-suggestion" && req.method === "POST") {
    try {
      const { itemName, nutritionContext } = await parseBody(req);

      if (!itemName) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "itemName is required" }));
        return;
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
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter error:", errorText);
        res.writeHead(response.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `OpenRouter error: ${response.status}` }));
        return;
      }

      const data = await response.json();
      const suggestion = data.choices?.[0]?.message?.content;

      if (!suggestion) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No suggestion returned" }));
        return;
      }

      const lines = suggestion.split("\n").filter((l) => l.trim() !== "");
      const healthSuggestion = lines[0]?.trim();
      const suggestionReason =
        lines.length > 1 ? lines.slice(1).join(" ").trim() : "";

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ healthSuggestion, suggestionReason }));
      console.log(`✅ ${itemName} → ${healthSuggestion}`);
    } catch (error) {
      console.error("Server error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 AteWell API server running at http://localhost:${PORT}`);
});

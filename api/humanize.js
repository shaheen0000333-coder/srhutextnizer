import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, tone } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text input" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Rewrite the following text in a more natural and human-like style with a ${tone || "neutral"} tone:\n\n${text}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a text humanizer tool." },
        { role: "user", content: prompt },
      ],
    });

    const output = response.choices[0]?.message?.content?.trim();
    res.status(200).json({ result: output });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
}

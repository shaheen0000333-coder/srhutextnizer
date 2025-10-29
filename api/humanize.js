import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  try {
    // example: using OpenAI-like model
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You rewrite AI text to sound natural and human-like." },
        { role: "user", content: text }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const humanized = response.data.choices[0].message.content;
    res.status(200).json({ humanized });
  } catch (err) {
    console.error("Humanize error:", err.response?.data || err.message);
    res.status(500).json({ error: "Server error" });
  }
}

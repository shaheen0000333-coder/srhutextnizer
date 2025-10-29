// api/humanize.js
export default async function handler(req, res) {
  const { text } = await req.json();

  if (!text) {
    return res.status(400).json({ error: "No text provided" });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a text humanizer. Rewrite the given text in a natural, human-like tone.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    }),
  });

  const data = await response.json();
  const humanized = data.choices?.[0]?.message?.content || "Error processing text.";

  return res.status(200).json({ result: humanized });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeName, rating, goodPoints = [], comment = "", returnIntent = "" } = req.body || {};

  if (!rating) {
    return res.status(400).json({ error: "rating is required" });
  }

  const prompt = `
あなたはGoogle口コミ用の文章作成アシスタントです。
利用者本人のアンケート回答だけを材料に、自然な日本語の口コミ文を1つ作ってください。

【ルール】
- 実際の回答にない体験・事実は絶対に追加しない
- 店舗から依頼された宣伝文ではなく、本人が書いたような自然な一人称にする
- 過度に褒めすぎない
- 80〜180文字程度
- 星の数を文章内に書かない
- 「口コミ投稿お願いします」など店舗側の文言は入れない
- 出力は口コミ本文のみ

店舗名: ${storeName || ""}
満足度: ${rating}/5
良かったところ: ${goodPoints.join("、") || "未回答"}
自由回答: ${comment || "未回答"}
再来店意向: ${returnIntent || "未回答"}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: "OpenAI API error" });
    }

    let text = data.output_text;
    if (!text && Array.isArray(data.output)) {
      text = data.output
        .flatMap(item => item.content || [])
        .filter(c => c.type === "output_text")
        .map(c => c.text)
        .join("\n");
    }

    return res.status(200).json({ review: (text || "").trim() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

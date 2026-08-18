export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const {
      storeName = "NEW PLANET",
      rating,
      goodPoints = [],
      comment = "",
      returnIntent = ""
    } = req.body || {};

    if (!rating) {
      return res.status(400).json({
        error: "満足度を選択してください。"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY が設定されていません。"
      });
    }

    const prompt = `
あなたはGoogle口コミ用の文章作成アシスタントです。

以下は実際に来店したお客様本人の回答です。
回答に含まれている内容だけを使って、自然な日本語の口コミを作成してください。

【重要ルール】
・回答にない体験や事実を勝手に追加しない
・広告のような文章にしない
・過度に褒めすぎない
・本人が自然に書いたような文章にする
・星の数を文章内に書かない
・「口コミ投稿お願いします」など店舗側の文言を入れない
・80〜180文字程度
・口コミ本文だけを出力する

店舗名：${storeName}
満足度：${rating}/5
良かったところ：${goodPoints.length ? goodPoints.join("、") : "未回答"}
特に印象に残ったこと：${comment || "未回答"}
再来店意向：${returnIntent || "未回答"}
`.trim();

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini APIへの接続に失敗しました。"
      });
    }

    const review =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!review) {
      console.error("Gemini returned no text:", data);

      return res.status(500).json({
        error: "口コミ文章を生成できませんでした。"
      });
    }

    return res.status(200).json({
      review
    });

  } catch (error) {
    console.error("generate.js error:", error);

    return res.status(500).json({
      error: error?.message || "サーバーエラーが発生しました。"
    });
  }
}
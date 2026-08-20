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

以下は、実際に来店したお客様本人が回答したアンケート内容です。
回答に含まれている事実だけを使い、自然な日本語の口コミ文を作成してください。

【ルール】
・回答にない体験や事実を追加しない
・広告や宣伝のような文章にしない
・過度に褒めすぎない
・お客様本人が自然に書いたような文章にする
・星の数を文章内に書かない
・店舗側から投稿を依頼する表現を入れない
・80〜180文字程度
・口コミ本文のみ出力する
・前置き、説明、引用符は付けない

店舗名：${storeName}
満足度：${rating}/5
良かったところ：${
      goodPoints.length ? goodPoints.join("、") : "未回答"
    }
特に印象に残ったこと：${comment || "未回答"}
再来店意向：${returnIntent || "未回答"}
`.trim();

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error (${response.status})`
      });
    }

    const review =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim();

    if (!review) {
      console.error(
        "Gemini returned no review:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error: "Geminiから口コミ文が返されませんでした。"
      });
    }

    return res.status(200).json({
      review: review
    });

  } catch (error) {
    console.error("generate.js error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "口コミ生成中にサーバーエラーが発生しました。"
    });
  }
}
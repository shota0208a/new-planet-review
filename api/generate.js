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
あなたは、実際にお店を利用したお客様のアンケート回答を、
自然で読みやすいGoogle口コミ文に整える文章アシスタントです。

以下の回答だけを材料に、
普通のお客様が自分で書いたような自然な口コミを1つ作成してください。

【最重要ルール】
・回答にない体験、事実、サービス、人物、感想を追加しない
・事実を創作しない
・選択肢を順番に並べただけの文章にしない
・選ばれた内容を自然な一つの感想としてつなげる
・広告や宣伝のような文章にしない
・過度に褒めすぎない
・不自然に丁寧すぎる文章にしない
・星の数を本文に書かない
・口コミ投稿をお願いする表現を入れない
・タイトル、前置き、説明、引用符は付けない
・口コミ本文だけを出力する

【文章の雰囲気】
・自然で親しみのある日本語
・100〜180文字程度
・2〜4文程度
・毎回少し言い回しを変える
・同じ単語や「良かったです」を何度も繰り返さない
・テンプレートっぽくしない
・自由回答がある場合は、その内容を文章の中心にする
・再来店意向は文章の最後に自然に反映する
・必ず文章を最後まで完結させる
・文の途中では絶対に出力を終了しない

【今回のお客様の回答】

店舗名：
${storeName}

満足度：
${rating}/5

良かったところ：
${goodPoints.length ? goodPoints.join("、") : "未回答"}

特に印象に残ったこと：
${comment || "未回答"}

また来たいと思いますか：
${returnIntent || "未回答"}

以上の回答だけを使って、
自然で読みやすく、最後まで完結したGoogle口コミ本文を1つ作成してください。
`.trim();

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

    async function generate(maxOutputTokens) {
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
            temperature: 0.9,
            topP: 0.9,
            maxOutputTokens
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          `Gemini API error (${response.status})`
        );
      }

      return data;
    }

    let data = await generate(1200);

    let candidate = data?.candidates?.[0];

    // 出力上限で途中終了した場合は、余裕を増やして自動再生成
    if (candidate?.finishReason === "MAX_TOKENS") {
      data = await generate(2000);
      candidate = data?.candidates?.[0];
    }

    let review =
      candidate?.content?.parts
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

    review = review
      .replace(/^["「『]/, "")
      .replace(/["」』]$/, "")
      .trim();

    return res.status(200).json({
      review
    });

  } catch (error) {
    console.error(
      "generate.js error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "口コミ生成中にサーバーエラーが発生しました。"
    });
  }
}
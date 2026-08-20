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

以下のアンケート回答だけを材料にして、
「普通のお客様が自分で書いたような自然な口コミ」を1つ作成してください。

【最重要ルール】
・回答に存在しない体験、出来事、サービス、人物、感想を絶対に追加しない
・事実を創作しない
・アンケートの選択肢をそのまま順番に並べただけの文章にしない
・選ばれた内容同士を、自然な感想としてつなげる
・情報を増やすのではなく、表現と言い回しを自然に広げる
・広告、宣伝、店舗紹介のような文章にしない
・過度に褒めすぎない
・不自然に丁寧すぎる文章にしない
・「最高でした！」「絶対おすすめです！」など大げさな定型表現を多用しない
・「口コミを書きます」「投稿します」など口コミそのものについて言及しない
・店舗側から投稿をお願いしているような表現を入れない
・星の数を本文に書かない
・口コミ本文だけを出力する
・前置き、タイトル、説明、引用符は付けない

【文章の作り方】
・100〜180文字程度を目安にする
・2〜4文程度で自然につなげる
・毎回同じ書き出しにしない
・「〜が良かったです。〜も良かったです。」の連続を避ける
・選択された複数の良かった点は、一つの体験として自然につなげる
・自由回答がある場合は、その内容を文章の中心にする
・自由回答がない場合は、選択された項目だけで無理なく文章を作る
・再来店意向は、文章の最後に自然に反映してよい
・会話調すぎず、かしこまりすぎない自然な日本語にする
・同じ単語を何度も繰り返さない
・テンプレート感のない文章にする

【満足度について】
満足度が高い場合でも、回答内容以上に評価を盛らないでください。
満足度が低い場合は、無理にポジティブな口コミに変換しないでください。

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
自然で本人らしいGoogle口コミ本文を1つ作成してください。
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
          temperature: 0.95,
          topP: 0.9,
          maxOutputTokens: 350
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error (${response.status})`
      });
    }

    let review =
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

    // 余計な引用符が付いた場合だけ除去
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
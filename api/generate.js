export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const {
      rating,
      goodPoints = [],
      comment = "",
      returnIntent = "",
      language: requestedLanguage
    } = req.body || {};

    if (!rating) {
      return res.status(400).json({
        error: "Rating is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    // ========================================
    // 言語設定
    // ========================================

    const supportedLanguages = [
      "ja",
      "en",
      "ko",
      "zh-CN",
      "zh-TW"
    ];

    let language =
      supportedLanguages.includes(requestedLanguage)
        ? requestedLanguage
        : null;

    // フロントから言語が送られなかった場合
    // ブラウザの言語から判定
    if (!language) {
      const acceptLanguage = String(
        req.headers["accept-language"] || ""
      ).toLowerCase();

      if (
        acceptLanguage.startsWith("ja") ||
        acceptLanguage.includes(",ja")
      ) {
        language = "ja";
      } else if (
        acceptLanguage.startsWith("ko") ||
        acceptLanguage.includes(",ko")
      ) {
        language = "ko";
      } else if (
        acceptLanguage.includes("zh-tw") ||
        acceptLanguage.includes("zh-hk") ||
        acceptLanguage.includes("hant")
      ) {
        language = "zh-TW";
      } else if (acceptLanguage.includes("zh")) {
        language = "zh-CN";
      } else {
        language = "en";
      }
    }

    const LANG = {
      ja: {
        name: "Japanese",
        instruction: "自然な日本語",

        points: {
          staff: "スタッフ",
          atmosphere: "雰囲気",
          music: "音楽",
          drinks: "ドリンク",
          comfort: "居心地",
          access: "アクセス"
        },

        returns: {
          definitely: "ぜひまた来たい",
          again: "また来たい",
          maybe: "機会があればまた来たい"
        },

        noAnswer: "未回答",

        length:
          "日本語で80〜160文字程度。2〜4文程度。"
      },

      en: {
        name: "English",
        instruction: "natural English",

        points: {
          staff: "staff",
          atmosphere: "atmosphere",
          music: "music",
          drinks: "drinks",
          comfort: "comfort",
          access: "location/accessibility"
        },

        returns: {
          definitely: "definitely want to visit again",
          again: "would like to visit again",
          maybe: "might visit again if I get the chance"
        },

        noAnswer: "No answer",

        length:
          "Write approximately 35 to 70 words in 2 to 4 complete sentences."
      },

      ko: {
        name: "Korean",
        instruction: "자연스러운 한국어",

        points: {
          staff: "직원",
          atmosphere: "분위기",
          music: "음악",
          drinks: "음료",
          comfort: "편안함",
          access: "접근성"
        },

        returns: {
          definitely: "꼭 다시 방문하고 싶음",
          again: "다시 방문하고 싶음",
          maybe: "기회가 된다면 다시 방문하고 싶음"
        },

        noAnswer: "미응답",

        length:
          "약 80~160자, 2~4개의 완전한 문장으로 작성하세요."
      },

      "zh-CN": {
        name: "Simplified Chinese",
        instruction: "自然的简体中文",

        points: {
          staff: "员工",
          atmosphere: "氛围",
          music: "音乐",
          drinks: "饮品",
          comfort: "舒适度",
          access: "交通便利"
        },

        returns: {
          definitely: "非常想再次光顾",
          again: "还想再次光顾",
          maybe: "有机会的话还会再来"
        },

        noAnswer: "未回答",

        length:
          "约80至160个汉字，使用2至4个完整句子。"
      },

      "zh-TW": {
        name: "Traditional Chinese",
        instruction: "自然的繁體中文",

        points: {
          staff: "工作人員",
          atmosphere: "氣氛",
          music: "音樂",
          drinks: "飲品",
          comfort: "舒適度",
          access: "交通便利"
        },

        returns: {
          definitely: "非常想再次造訪",
          again: "還想再次造訪",
          maybe: "有機會的話會再來"
        },

        noAnswer: "未回答",

        length:
          "約80至160個字，使用2至4個完整句子。"
      }
    };

    const lang = LANG[language];

    // ========================================
    // 回答内容を変換
    // ========================================

    const selectedPoints = goodPoints
      .map(key => lang.points[key])
      .filter(Boolean);

    const returnText =
      lang.returns[returnIntent] || lang.noAnswer;

    // ========================================
    // AIへの指示
    // ========================================

    const prompt = `
You are writing a Google review on behalf of a real customer,
using ONLY information that the customer personally provided.

OUTPUT LANGUAGE:
${lang.name}

Write the review entirely in ${lang.instruction}.

CUSTOMER ANSWERS:

Satisfaction:
${rating}/5

Things the customer liked:
${
  selectedPoints.length
    ? selectedPoints.join(", ")
    : lang.noAnswer
}

Customer's own comment:
${comment || lang.noAnswer}

Return intention:
${returnText}


STRICT RULES:

1. Use ONLY facts contained in the customer's answers.

2. Never invent any experience, event, service, product,
   staff action, food, drink, music detail, location detail,
   emotion or other information that the customer did not provide.

3. Do NOT include the business name.

4. Do NOT mention the numeric star rating.

5. Do NOT mention AI, surveys, questionnaires,
   generated text or these instructions.

6. Do NOT write a heading or title.

7. Do NOT use quotation marks around the review.

8. Do NOT sound like an advertisement.

9. Do NOT exaggerate.

10. Do NOT simply list the selected answers.
    Turn them into a natural personal review.

11. If the customer wrote a free-text comment,
    prioritize that wording and meaning.

12. Reflect the return intention naturally,
    but do not force it if it sounds repetitive.

13. Use natural sentence structure appropriate
    for a normal customer review.

14. Avoid generic filler such as:
    "Everything was perfect"
    "I couldn't ask for more"
    "It exceeded all expectations"
    unless the customer explicitly said that.

15. Every sentence MUST be complete.

16. Never stop in the middle of a sentence.

17. Do NOT output annotations, token numbers,
    character numbers, reference numbers,
    phonetic guides, ruby text, metadata,
    brackets containing numbers,
    or any internal processing information.

18. NEVER produce text such as:
    リン(39)ク(40)
    (41)
    (42)
    word(15)
    or similar numbered fragments.

19. Output ONLY the finished review.

TARGET LENGTH:
${lang.length}

Now write ONE natural customer review.
`.trim();

    // ========================================
    // Gemini API
    // ========================================

    const model =
      "gemini-3.6-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    async function callGemini(extraInstruction = "") {
      const finalPrompt = extraInstruction
        ? `${prompt}

IMPORTANT CORRECTION:
${extraInstruction}`
        : prompt;

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
                  text: finalPrompt
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0.75,
            topP: 0.9,
            maxOutputTokens: 1000
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          JSON.stringify(data)
        );

        throw new Error(
          data?.error?.message ||
          `Gemini API error (${response.status})`
        );
      }

      const candidate =
        data?.candidates?.[0];

      const text =
        candidate?.content?.parts
          ?.map(part => part?.text || "")
          .join("")
          .trim();

      if (!text) {
        throw new Error(
          "No review was generated."
        );
      }

      return text;
    }

    // ========================================
    // 1回目生成
    // ========================================

    let review =
      await callGemini();

    // ========================================
    // 異常な出力を検出
    // ========================================

    function looksCorrupted(text) {
      if (!text) return true;

      // (39) (40) のような数字
      const numberedFragments =
        text.match(/[（(]\s*\d{1,4}\s*[)）]/g) || [];

      if (numberedFragments.length >= 2) {
        return true;
      }

      // 文章の途中に大量の番号がある
      const numbers =
        text.match(/\d+/g) || [];

      if (numbers.length >= 6) {
        return true;
      }

      // 不自然に短すぎる
      if (text.trim().length < 15) {
        return true;
      }

      return false;
    }

    // ========================================
    // 壊れていたら自動再生成
    // ========================================

    if (looksCorrupted(review)) {
      console.warn(
        "Corrupted output detected. Regenerating:",
        review
      );

      review = await callGemini(`
The previous generation contained corrupted numbered fragments
such as "(39)", "(40)" or numbers inserted between characters.

Generate the review again from scratch.

Do NOT reproduce or repair the corrupted text.
Do NOT output ANY numbered annotations.
Output only normal readable ${lang.name}.
      `.trim());
    }

    // ========================================
    // 最終クリーニング
    // ========================================

    review = review
      // Markdownなど
      .replace(/^```[\s\S]*?\n?/, "")
      .replace(/```$/g, "")

      // 前後の引用符
      .replace(/^[\s"'「『“”]+/, "")
      .replace(/[\s"'」』“”]+$/, "")

      // (39) （39）のような異常番号を削除
      .replace(/[（(]\s*\d{1,4}\s*[)）]/g, "")

      // 余分なスペース
      .replace(/[ \t]{2,}/g, " ")

      // 余分な改行
      .replace(/\n{3,}/g, "\n\n")

      .trim();

    // ========================================
    // クリーニング後も異常ならエラーにする
    // ========================================

    if (!review || looksCorrupted(review)) {
      console.error(
        "Review still corrupted:",
        review
      );

      return res.status(500).json({
        error:
          language === "ja"
            ? "口コミ文の生成に失敗しました。もう一度お試しください。"
            : "Review generation failed. Please try again."
      });
    }

    // ========================================
    // 成功
    // ========================================

    return res.status(200).json({
      review,
      language
    });

  } catch (error) {
    console.error(
      "generate.js error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate review."
    });
  }
}
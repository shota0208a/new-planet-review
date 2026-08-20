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

    const supported = [
      "ja",
      "en",
      "ko",
      "zh-CN",
      "zh-TW"
    ];

    let language =
      supported.includes(requestedLanguage)
        ? requestedLanguage
        : null;

    if (!language) {
      const acceptLanguage = String(
        req.headers["accept-language"] || ""
      ).toLowerCase();

      if (acceptLanguage.includes("ja")) {
        language = "ja";
      } else if (acceptLanguage.includes("ko")) {
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
        none: "未回答",
        length: "80〜160文字程度、2〜4文"
      },

      en: {
        name: "English",
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
        none: "No answer",
        length: "35 to 70 words, 2 to 4 sentences"
      },

      ko: {
        name: "Korean",
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
        none: "미응답",
        length: "약 80~160자, 2~4문장"
      },

      "zh-CN": {
        name: "Simplified Chinese",
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
        none: "未回答",
        length: "约80至160个汉字，2至4句话"
      },

      "zh-TW": {
        name: "Traditional Chinese",
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
        none: "未回答",
        length: "約80至160個字，2至4句話"
      }
    };

    const lang = LANG[language];

    const selectedPoints = goodPoints
      .map(key => lang.points[key])
      .filter(Boolean);

    const returnText =
      lang.returns[returnIntent] || lang.none;

    const prompt = `
Create exactly one natural Google review in ${lang.name}.

Use ONLY the customer's answers below.

Customer answers:
Satisfaction: ${rating}/5

Positive points:
${
  selectedPoints.length
    ? selectedPoints.join(", ")
    : lang.none
}

Free comment:
${comment || lang.none}

Return intention:
${returnText}

Rules:
- Write entirely in ${lang.name}.
- Do not include the business name.
- Do not mention the numeric rating.
- Do not mention AI or a survey.
- Do not invent facts or experiences.
- Do not simply list the selected options.
- Make it sound like a real customer wrote it.
- Keep the tone natural, not promotional.
- Avoid exaggerated praise.
- If there is a free comment, prioritize it.
- Finish every sentence.
- Do not output annotations.
- Do not output reference numbers.
- Do not put numbers in parentheses.
- Do not insert token indexes or character indexes.
- Do not output ruby or pronunciation guides.
- Return only the review text inside the requested JSON field.
- Target length: ${lang.length}.
`.trim();

    const model = "gemini-3.5-flash-lite";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

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
          maxOutputTokens: 500,

          responseMimeType:
            "application/json",

          responseSchema: {
            type: "object",

            properties: {
              review: {
                type: "string",
                description:
                  `A complete natural customer review written only in ${lang.name}. No annotations or numbered fragments.`
              }
            },

            required: [
              "review"
            ]
          }
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

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

    if (!raw) {
      return res.status(500).json({
        error: "No review was generated."
      });
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(
        "Invalid JSON from Gemini:",
        raw
      );

      return res.status(500).json({
        error:
          language === "ja"
            ? "口コミ文の生成に失敗しました。もう一度お試しください。"
            : "Review generation failed. Please try again."
      });
    }

    let review =
      String(parsed?.review || "").trim();

    if (!review) {
      return res.status(500).json({
        error:
          language === "ja"
            ? "口コミ文が生成されませんでした。"
            : "No review was generated."
      });
    }

    // 異常な番号付き断片が混ざったら採用しない
    const suspicious =
      review.match(
        /[（(]\s*\d{1,4}\s*[)）]/g
      ) || [];

    if (suspicious.length > 0) {
      console.error(
        "Corrupted review rejected:",
        review
      );

      return res.status(500).json({
        error:
          language === "ja"
            ? "文章生成に異常が発生しました。「作り直す」を押してください。"
            : "The generated text was invalid. Please try again."
      });
    }

    review = review
      .replace(/^[「『"'“]+/, "")
      .replace(/[」』"'”]+$/, "")
      .trim();

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
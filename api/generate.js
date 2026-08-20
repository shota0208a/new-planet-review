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
        error:"Rating is required."
      });

    }


    const apiKey =
      process.env.GEMINI_API_KEY;


    if (!apiKey) {

      return res.status(500).json({
        error:
          "GEMINI_API_KEY is not configured."
      });

    }


    // ---------------------
    // 言語
    // ---------------------

    const supportedLanguages =
      ["ja","en","ko","zh-CN","zh-TW"];


    let language =
      supportedLanguages.includes(requestedLanguage)
        ? requestedLanguage
        : null;


    // フロントから言語が来なかった場合も
    // ブラウザのAccept-Languageから判定
    if (!language) {

      const header =
        String(
          req.headers["accept-language"] ||
          ""
        ).toLowerCase();


      if (header.includes("ja")) {

        language = "ja";

      } else if (header.includes("ko")) {

        language = "ko";

      } else if (
        header.includes("zh-tw") ||
        header.includes("zh-hk") ||
        header.includes("hant")
      ) {

        language = "zh-TW";

      } else if (header.includes("zh")) {

        language = "zh-CN";

      } else {

        language = "en";

      }

    }


    const LANG = {

      ja:{
        name:"Japanese",

        points:{
          staff:"スタッフ",
          atmosphere:"雰囲気",
          music:"音楽",
          drinks:"ドリンク",
          comfort:"居心地",
          access:"アクセス"
        },

        returns:{
          definitely:"ぜひまた来たい",
          again:"また来たい",
          maybe:"機会があればまた来たい"
        },

        noAnswer:"未回答",

        length:
          "100〜180文字程度、2〜4文程度"
      },


      en:{
        name:"English",

        points:{
          staff:"staff",
          atmosphere:"atmosphere",
          music:"music",
          drinks:"drinks",
          comfort:"comfort",
          access:"location and accessibility"
        },

        returns:{
          definitely:"definitely want to visit again",
          again:"would like to visit again",
          maybe:"might visit again if I get the chance"
        },

        noAnswer:"No answer",

        length:
          "about 40 to 90 words"
      },


      ko:{
        name:"Korean",

        points:{
          staff:"직원",
          atmosphere:"분위기",
          music:"음악",
          drinks:"음료",
          comfort:"편안함",
          access:"접근성"
        },

        returns:{
          definitely:"꼭 다시 방문하고 싶음",
          again:"다시 방문하고 싶음",
          maybe:"기회가 된다면 다시 방문하고 싶음"
        },

        noAnswer:"미응답",

        length:
          "약 100~180자, 자연스러운 2~4문장"
      },


      "zh-CN":{
        name:"Simplified Chinese",

        points:{
          staff:"员工",
          atmosphere:"氛围",
          music:"音乐",
          drinks:"饮品",
          comfort:"舒适度",
          access:"交通便利"
        },

        returns:{
          definitely:"非常想再次光顾",
          again:"还想再次光顾",
          maybe:"有机会的话还会再来"
        },

        noAnswer:"未回答",

        length:
          "约100至180个汉字，2至4句话"
      },


      "zh-TW":{
        name:"Traditional Chinese",

        points:{
          staff:"工作人員",
          atmosphere:"氣氛",
          music:"音樂",
          drinks:"飲品",
          comfort:"舒適度",
          access:"交通便利"
        },

        returns:{
          definitely:"非常想再次造訪",
          again:"還想再次造訪",
          maybe:"有機會的話會再來"
        },

        noAnswer:"未回答",

        length:
          "約100至180個字，2至4句話"
      }

    };


    const lang =
      LANG[language];


    const selectedPoints =
      goodPoints
        .map(key =>
          lang.points[key]
        )
        .filter(Boolean);


    const returnText =
      lang.returns[returnIntent] ||
      lang.noAnswer;


    // ---------------------
    // プロンプト
    // ---------------------

    const prompt = `
You are helping a real customer turn their own survey answers into a natural Google review.

OUTPUT LANGUAGE:
${lang.name}

The entire final review MUST be written in ${lang.name}.

Use ONLY information that the customer actually provided.

Never invent:
- experiences
- services
- products
- staff behavior
- events
- emotions
- details
that are not present in the customer's answers.

IMPORTANT WRITING RULES:

- Do NOT include the business name.
- Do NOT mention the star rating.
- Do NOT mention AI.
- Do NOT mention this survey.
- Do NOT explain what you are doing.
- Do NOT write a title.
- Do NOT wrap the review in quotation marks.
- Do NOT sound like advertising.
- Do NOT exaggerate.
- Do NOT simply list the selected options.
- Connect the answers naturally as one personal experience.
- Avoid repetitive expressions.
- Avoid generic review templates.
- Vary sentence structure.
- Keep the tone natural and believable.
- The customer should sound like a normal person writing about their own experience.
- If a free-text comment exists, give it priority.
- Reflect the return intention naturally near the end when appropriate.
- Finish every sentence completely.
- Never stop in the middle of a sentence.
- Output ONLY the finished review.

TARGET LENGTH:
${lang.length}


CUSTOMER ANSWERS:

Satisfaction:
${rating}/5

Positive points:
${
  selectedPoints.length
    ? selectedPoints.join(", ")
    : lang.noAnswer
}

Customer's own comment:
${
  comment ||
  lang.noAnswer
}

Return intention:
${returnText}


Now write exactly one natural review in ${lang.name}.

Again:
Do NOT include the business name.
Do NOT add facts that were not supplied.
`.trim();


    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";


    async function generate(maxOutputTokens) {

      const response =
        await fetch(
          url,
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json",

              "x-goog-api-key":
                apiKey
            },

            body:JSON.stringify({

              contents:[
                {
                  role:"user",
                  parts:[
                    {
                      text:prompt
                    }
                  ]
                }
              ],

              generationConfig:{
                temperature:0.9,
                topP:0.9,
                maxOutputTokens
              }

            })
          }
        );


      const data =
        await response.json();


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


      return data;
    }


    let data =
      await generate(1200);


    let candidate =
      data?.candidates?.[0];


    if (
      candidate?.finishReason ===
      "MAX_TOKENS"
    ) {

      data =
        await generate(2000);

      candidate =
        data?.candidates?.[0];

    }


    let review =
      candidate
        ?.content
        ?.parts
        ?.map(part =>
          part?.text || ""
        )
        .join("")
        .trim();


    if (!review) {

      console.error(
        "No review returned:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "No review was generated."
      });

    }


    review =
      review
        .replace(
          /^["「『“]/
          ,""
        )
        .replace(
          /["」』”]$/,
          ""
        )
        .trim();


    return res.status(200).json({
      review,
      language
    });


  } catch(error) {

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
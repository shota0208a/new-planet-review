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

      language = "en"

    } = req.body || {};


    if (!rating) {

      return res.status(400).json({
        error:
          "Rating is required."
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


    const LANGUAGES = {

      ja:{
        name:"Japanese",

        good:{
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
        }
      },


      en:{
        name:"English",

        good:{
          staff:"staff",
          atmosphere:"atmosphere",
          music:"music",
          drinks:"drinks",
          comfort:"comfort",
          access:"location/access"
        },

        returns:{
          definitely:"definitely want to visit again",
          again:"would like to visit again",
          maybe:"might visit again if I get the chance"
        }
      },


      ko:{
        name:"Korean",

        good:{
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
        }
      },


      "zh-CN":{
        name:"Simplified Chinese",

        good:{
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
        }
      },


      "zh-TW":{
        name:"Traditional Chinese",

        good:{
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
        }
      }

    };


    const lang =
      LANGUAGES[language] ||
      LANGUAGES.en;


    const selectedPoints =
      goodPoints
        .map(
          key =>
            lang.good[key]
        )
        .filter(Boolean);


    const returnText =
      lang.returns[
        returnIntent
      ] || "";


    const prompt = `
You are a writing assistant that helps a real customer turn their own survey answers into a natural Google review.

Write the final review in ${lang.name}.

IMPORTANT:
The review must sound like it was naturally written by the customer themselves.

Never mention the business name in the review.

Use ONLY information contained in the customer's answers below.

Do not invent:
- experiences
- services
- people
- products
- events
- feelings
- details that the customer did not provide

Do not simply list the selected survey options.

Instead, naturally connect the customer's answers into a short, human-sounding review.

STYLE RULES:
- Natural and conversational
- Not promotional
- Not like advertising copy
- Do not exaggerate
- Avoid repetitive phrases
- Avoid generic templates
- Vary sentence structure
- Do not mention the star rating
- Do not mention this survey
- Do not mention AI
- Do not ask other people to leave reviews
- Do not include a title
- Do not use quotation marks around the result
- Output ONLY the finished review
- Complete every sentence fully
- Never stop halfway through a sentence

LENGTH:
Approximately 80 to 180 characters for Japanese, Chinese or Korean.
Approximately 40 to 100 words for English.

CUSTOMER ANSWERS:

Satisfaction:
${rating}/5

Positive points:
${
  selectedPoints.length
    ? selectedPoints.join(", ")
    : "No answer"
}

Customer's own comment:
${
  comment ||
  "No answer"
}

Return intention:
${
  returnText ||
  "No answer"
}

Create one natural review now.

Remember:
Do not include the business name.
`.trim();


    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";


    async function generate(
      maxOutputTokens = 1200
    ) {

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

            body:
              JSON.stringify({

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

                  temperature:0.95,

                  topP:0.92,

                  maxOutputTokens

                }

              })

          }
        );


      const data =
        await response.json();


      if(!response.ok){

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


    if(
      candidate?.finishReason ===
      "MAX_TOKENS"
    ){

      data =
        await generate(2000);

      candidate =
        data?.candidates?.[0];

    }


    let review =
      candidate
        ?.content
        ?.parts
        ?.map(
          part =>
            part?.text || ""
        )
        .join("")
        .trim();


    if(!review){

      console.error(
        "Gemini returned no review:",
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
      review
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
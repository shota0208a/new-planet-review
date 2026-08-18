export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  return res.status(200).json({
    success: true,
    message: "API connection OK"
  });
}
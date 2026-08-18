// Vercel connection test
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  return res.status(200).json({
  review: "これはAPI接続テストです。正常に表示されています。"
});
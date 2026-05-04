export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Global client check (limited in serverless)
  const isReady = global.client && global.isReady;
  
  res.status(200).json({
    ready: isReady || false,
    message: isReady ? "WhatsApp Connected" : "Not Connected"
  });
}

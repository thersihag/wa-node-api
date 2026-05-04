import qrcode from 'qrcode';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (global.qrCodeData) {
    res.status(200).json({ qr: global.qrCodeData });
  } else if (global.isReady) {
    res.status(200).json({ message: "Already Logged In ✅" });
  } else {
    res.status(200).json({ message: "Waiting for QR... Refresh again" });
  }
}

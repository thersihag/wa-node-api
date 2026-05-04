import { Client, MessageMedia, LocalAuth } from 'whatsapp-web.js';
import multer from 'multer';
import { promises as fs } from 'fs';

const upload = multer({ dest: 'tmp/' });

export const config = {
  api: {
    bodyParser: false,   // Important for file upload
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Multer setup for file
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(500).json({ error: err.message });

    const { number, caption } = req.body;

    try {
      if (!global.client || !global.isReady) {
        return res.status(400).json({ error: "WhatsApp not ready" });
      }

      const media = MessageMedia.fromFilePath(req.file.path);
      const chatId = `${number}@c.us`;

      await global.client.sendMessage(chatId, media, { caption: caption || "" });

      // Delete file
      await fs.unlink(req.file.path);

      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

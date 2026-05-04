import { Client, LocalAuth } from 'whatsapp-web.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: "Number and message required" });
  }

  try {
    // Initialize client if not exists (limited in serverless)
    if (!global.client) {
      global.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
        }
      });

      global.client.on('ready', () => {
        global.isReady = true;
      });

      await global.client.initialize();
    }

    if (!global.isReady) {
      return res.status(400).json({ error: "WhatsApp not ready yet" });
    }

    const chatId = `${number}@c.us`;
    await global.client.sendMessage(chatId, message);

    res.status(200).json({ success: true, status: "Message Sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

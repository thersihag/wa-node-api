import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Agar client exist nahi karta to initialize karo
    if (!global.client) {
      global.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          args: chromium.args,
          executablePath: await chromium.executablePath(),
          headless: true,
        }
      });

      global.client.on('qr', async (qr) => {
        console.log("QR Generated");
        global.qrCodeData = await qrcode.toDataURL(qr);
      });

      global.client.on('ready', () => {
        console.log("WhatsApp Ready");
        global.isReady = true;
      });

      await global.client.initialize();
    }

    // QR return logic
    if (global.qrCodeData) {
      return res.status(200).json({ qr: global.qrCodeData });
    }

    if (global.isReady) {
      return res.status(200).json({ message: "Already Logged In ✅" });
    }

    return res.status(200).json({ message: "QR generate ho raha hai... 2-3 sec baad refresh karo" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}

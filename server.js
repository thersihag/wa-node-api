import express from 'express';
import { Client, MessageMedia, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({ origin: '*' }));   // Frontend kahin se bhi hit kar sake
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Global variables
let client;
let isReady = false;
let qrCodeData = null;   // QR code base64 store karne ke liye

// ==================== WhatsApp Client ====================
function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth({ clientId: "bulk-sender" }),
        puppeteer: { 
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Received');
        qrCodeData = await qrcode.toDataURL(qr);
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Ready!');
        isReady = true;
        qrCodeData = null;
    });

    client.on('authenticated', () => console.log('✅ Authenticated'));
    client.on('disconnected', () => { isReady = false; });

    client.initialize();
}

// ==================== Routes ====================

// Check Status
app.get('/status', (req, res) => {
    res.json({ ready: isReady, hasQR: !!qrCodeData });
});

// Get QR Code
app.get('/qr', async (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else if (isReady) {
        res.json({ message: "Already Logged In" });
    } else {
        res.json({ message: "QR generating... Refresh again" });
    }
});

// Send Text
app.post('/send', async (req, res) => {
    if (!isReady) return res.status(400).json({ error: "WhatsApp not connected" });

    const { number, message } = req.body;
    try {
        const chatId = `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true, status: "Sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Media
app.post('/send-media', upload.single('file'), async (req, res) => {
    if (!isReady) return res.status(400).json({ error: "WhatsApp not connected" });

    const { number, caption } = req.body;
    try {
        const media = MessageMedia.fromFilePath(req.file.path);
        const chatId = `${number}@c.us`;
        await client.sendMessage(chatId, media, { caption: caption || "" });
        
        fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API Running on port ${PORT}`);
    initializeClient();
});

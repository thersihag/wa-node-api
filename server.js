import express from 'express';
import qrcode from 'qrcode';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// whatsapp-web.js ko sahi tarike se import kar rahe hain
import whatsapp from 'whatsapp-web.js';
const { Client, MessageMedia, LocalAuth } = whatsapp;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

// Global variables
let client;
let isReady = false;

function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth(), 
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
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Code Received!');
        try {
            const qrImage = await qrcode.toDataURL(qr);
            fs.writeFileSync(path.join(__dirname, 'public', 'qr.png'), 
                qrImage.replace(/^data:image\/png;base64,/, ''), 'base64');
            console.log('✅ QR saved to public/qr.png');
        } catch (err) {
            console.error('QR save error:', err);
        }
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is Ready!');
        isReady = true;
    });

    client.on('authenticated', () => {
        console.log('✅ WhatsApp Authenticated Successfully');
    });

    client.initialize();
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/qr', (req, res) => {
    const qrPath = path.join(__dirname, 'public', 'qr.png');
    if (fs.existsSync(qrPath)) {
        res.send(`
            <h2>WhatsApp se QR Code Scan Karo</h2>
            <img src="/qr.png" width="320"><br><br>
            <a href="/">← Dashboard</a>
        `);
    } else {
        res.send('QR abhi generate ho raha hai... Page ko 8-10 seconds baad refresh karo.');
    }
});

// Send Text
app.post('/send', async (req, res) => {
    if (!isReady) return res.status(400).json({ error: "WhatsApp abhi ready nahi hai" });

    const { number, message } = req.body;
    try {
        const chatId = `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true, msg: "Message bhej diya!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Media
app.post('/send-media', upload.single('file'), async (req, res) => {
    if (!isReady) return res.status(400).json({ error: "WhatsApp not ready" });

    const { number, caption } = req.body;
    try {
        const media = MessageMedia.fromFilePath(req.file.path);
        const chatId = `${number}@c.us`;
        await client.sendMessage(chatId, media, { caption: caption || "" });
        
        fs.unlinkSync(req.file.path); // delete after send
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    initializeClient();
});

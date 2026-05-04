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
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // index.html ke liye

const upload = multer({ dest: 'uploads/' });

// Global client
let client;
let isReady = false;

// Initialize WhatsApp Client
function initializeClient() {
    client = new Client({
        authStrategy: new LocalAuth(), // session save karega
        puppeteer: { 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Code Received!');
        const qrImage = await qrcode.toDataURL(qr);
        
        // Public folder mein QR save kar do
        fs.writeFileSync(path.join(__dirname, 'public', 'qr.png'), 
            qrImage.replace(/^data:image\/png;base64,/, ''), 'base64');
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp is Ready!');
        isReady = true;
    });

    client.on('authenticated', () => {
        console.log('✅ Authenticated');
    });

    client.initialize();
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// QR Code page
app.get('/qr', (req, res) => {
    if (fs.existsSync(path.join(__dirname, 'public', 'qr.png'))) {
        res.send(`
            <h2>Scan this QR Code with WhatsApp</h2>
            <img src="/qr.png" width="300"><br><br>
            <a href="/">Back to Dashboard</a>
        `);
    } else {
        res.send('QR not generated yet. Refresh after 5-10 seconds.');
    }
});

// Send Text Message
app.post('/send', async (req, res) => {
    if (!isReady) return res.status(400).json({ error: "WhatsApp not ready" });

    const { number, message } = req.body;
    try {
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true, message: "Sent!" });
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
        await client.sendMessage(chatId, media, { caption });
        
        // Delete file after sending
        fs.unlinkSync(req.file.path);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    initializeClient();
});

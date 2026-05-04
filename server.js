import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));   // index.html serve karne ke liye

let sock = null;
let connectionStatus = "disconnected";
let currentQR = null;

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('sessions');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            markRead: true,
            retryRequestDelay: 5000,
            browser: ['Chrome', 'Desktop', '1.0'],
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;

            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
                connectionStatus = "qr";
                console.log("📱 QR CODE GENERATED");
            }

            if (connection === 'open') {
                connectionStatus = "connected";
                currentQR = null;
                console.log("✅ WhatsApp Connected!");
            }

            if (connection === 'close') {
                connectionStatus = "disconnected";
                currentQR = null;
                setTimeout(connectToWhatsApp, 8000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error(error);
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ status: "qr", qr: currentQR });
    } else if (connectionStatus === "connected") {
        res.json({ status: "connected", message: "✅ Connected" });
    } else {
        if (!sock) connectToWhatsApp();
        res.json({ status: "connecting", message: "Connecting..." });
    }
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (connectionStatus !== "connected") {
        return res.status(400).json({ error: "Not connected" });
    }
    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running → http://localhost:${PORT}`);
    connectToWhatsApp();
});

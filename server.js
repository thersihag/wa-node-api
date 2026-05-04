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

// Serve static files (index.html)
app.use(express.static('.'));

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
                console.log("✅ WhatsApp Connected Successfully!");
            }

            if (connection === 'close') {
                connectionStatus = "disconnected";
                currentQR = null;
                setTimeout(connectToWhatsApp, 8000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("Error:", error);
    }
}

// ==================== ROUTES ====================
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus });
});

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ status: "qr", qr: currentQR });
    } else if (connectionStatus === "connected") {
        res.json({ status: "connected", message: "Already Connected" });
    } else {
        if (!sock) connectToWhatsApp();
        res.json({ 
            status: connectionStatus, 
            message: "Connecting... Refresh after few seconds" 
        });
    }
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (connectionStatus !== "connected") {
        return res.status(400).json({ error: "WhatsApp not connected" });
    }

    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true, message: "Message sent successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    connectToWhatsApp();
});

import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Global variables
let sock = null;
let connectionStatus = "disconnected";
let currentQR = null;

// Connect to WhatsApp
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sessions');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markRead: true,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            currentQR = await QRCode.toDataURL(qr);
            connectionStatus = "qr";
            console.log("📱 QR Code Generated");
        }

        if (connection === 'open') {
            connectionStatus = "connected";
            currentQR = null;
            console.log("✅ WhatsApp Connected Successfully!");
        }

        if (connection === 'close') {
            connectionStatus = "disconnected";
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// ==================== ROUTES ====================

// Get QR Code
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ status: "qr", qr: currentQR });
    } else if (connectionStatus === "connected") {
        res.json({ status: "connected" });
    } else {
        res.json({ status: "disconnected" });
    }
});

// Send Text Message
app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!sock || connectionStatus !== "connected") {
        return res.status(400).json({ error: "WhatsApp not connected" });
    }

    if (!number || !message) {
        return res.status(400).json({ error: "Number and message are required" });
    }

    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Status
app.get('/status', (req, res) => {
    res.json({ status: connectionStatus });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    connectToWhatsApp();
});

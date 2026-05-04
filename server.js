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

let sock = null;
let connectionStatus = "disconnected";
let currentQR = null;

// Strong Connect Function
async function connectToWhatsApp(retry = 0) {
    try {
        console.log(`🔄 Connecting to WhatsApp... (Attempt ${retry + 1})`);

        const { state, saveCreds } = await useMultiFileAuthState('sessions');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            markRead: true,
            logger: console,           // Extra logging
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
                connectionStatus = "qr";
                console.log("✅ QR CODE SUCCESSFULLY GENERATED!");
            }

            if (connection === 'open') {
                connectionStatus = "connected";
                currentQR = null;
                console.log("🎉 WhatsApp Connected Successfully!");
            }

            if (connection === 'close') {
                connectionStatus = "disconnected";
                currentQR = null;
                console.log("Connection closed, reconnecting...");
                setTimeout(() => connectToWhatsApp(), 8000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error("Connection Error:", err);
        if (retry < 3) {
            setTimeout(() => connectToWhatsApp(retry + 1), 5000);
        }
    }
}

// ==================== ROUTES ====================
app.get('/', (req, res) => res.json({ success: true, message: "WA API Running" }));

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus });
});

app.get('/qr', async (req, res) => {
    if (currentQR) {
        return res.json({ status: "qr", qr: currentQR });
    }

    if (connectionStatus !== "qr") {
        // Force reconnect
        if (!sock) {
            await connectToWhatsApp();
        }
    }

    res.json({
        status: connectionStatus,
        message: currentQR ? "QR Ready" : "Waiting for QR... Refresh after 8-10 seconds"
    });
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (!sock || connectionStatus !== "connected") {
        return res.status(400).json({ error: "WhatsApp not connected" });
    }
    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true, message: "Sent" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server started on port ${PORT}`);
    connectToWhatsApp();
});

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
let pairingCode = null;

// Connect with Pairing Code Support
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('sessions');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            markRead: true,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
                connectionStatus = "qr";
                console.log("📱 QR Generated");
            }

            if (connection === 'open') {
                connectionStatus = "connected";
                currentQR = null;
                pairingCode = null;
                console.log("✅ WhatsApp Connected!");
            }

            if (connection === 'close') {
                connectionStatus = "disconnected";
                setTimeout(connectToWhatsApp, 5000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Pairing Code Generate (for servers)
        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    pairingCode = await sock.requestPairingCode(""); // Phone number optional
                    console.log("🔢 Pairing Code:", pairingCode);
                } catch (e) {}
            }, 3000);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

// ==================== ROUTES ====================
app.get('/', (req, res) => {
    res.json({ success: true, message: "WA Node API Running" });
});

app.get('/status', (req, res) => {
    res.json({ status: connectionStatus });
});

app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({ status: "qr", qr: currentQR });
    } else if (pairingCode) {
        res.json({ 
            status: "pairing", 
            pairingCode: pairingCode,
            message: "WhatsApp mein jaake Pairing Code se connect karo"
        });
    } else {
        connectToWhatsApp();
        res.json({ 
            status: "connecting", 
            message: "Connecting... Refresh after 10 seconds" 
        });
    }
});

app.post('/send', async (req, res) => {
    const { number, message } = req.body;
    if (connectionStatus !== "connected") {
        return res.status(400).json({ error: "Not connected yet" });
    }
    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
    connectToWhatsApp();
});

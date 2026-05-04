import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import dotenv from 'dotenv';
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Global Variables
let sock = null;
let connectionStatus = "disconnected";
let currentQR = null;

// ==================== CONNECT TO WHATSAPP ====================
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('sessions');

        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            markRead: true,
            retryRequestDelay: 5000,
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
                connectionStatus = "qr";
                console.log("📱 QR CODE GENERATED - Ready to Scan");
            }

            if (connection === 'open') {
                connectionStatus = "connected";
                currentQR = null;
                console.log("✅ WhatsApp Connected Successfully!");
            }

            if (connection === 'close') {
                connectionStatus = "disconnected";
                currentQR = null;
                console.log("❌ Connection Closed. Reconnecting in 5 seconds...");
                
                // Auto Reconnect
                setTimeout(connectToWhatsApp, 5000);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.error("Connection Error:", error);
    }
}

// ==================== ROUTES ====================

// Home Route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "🚀 WA Node API is Running Successfully!",
        version: "1.0.0",
        endpoints: {
            "GET  /": "This message",
            "GET  /status": "Check connection status",
            "GET  /qr": "Get QR Code",
            "POST /send": "Send WhatsApp Message"
        }
    });
});

// Status Route
app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        connected: connectionStatus === "connected"
    });
});

// QR Code Route
app.get('/qr', (req, res) => {
    if (currentQR) {
        res.json({
            status: "qr",
            qr: currentQR,
            message: "Scan this QR with WhatsApp"
        });
    } else if (connectionStatus === "connected") {
        res.json({
            status: "connected",
            message: "✅ Already Connected to WhatsApp"
        });
    } else {
        // Try to reconnect if no QR
        if (!sock) {
            connectToWhatsApp();
        }
        res.json({
            status: "disconnected",
            message: "Connecting... Please refresh after 5-10 seconds"
        });
    }
});

// Send Message Route
app.post('/send', async (req, res) => {
    const { number, message } = req.body;

    if (!sock || connectionStatus !== "connected") {
        return res.status(400).json({
            error: "WhatsApp not connected. Please scan QR first."
        });
    }

    if (!number || !message) {
        return res.status(400).json({
            error: "Number and message are required"
        });
    }

    try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.json({
            success: true,
            message: "Message sent successfully",
            to: number
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to send message",
            details: error.message
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    connectToWhatsApp();   // Start WhatsApp Connection
});

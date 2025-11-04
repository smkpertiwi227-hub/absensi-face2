import { 
    makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    delay 
} from "@whiskeysockets/baileys";
import pino from "pino";
import dotenv from "dotenv";

dotenv.config();

// ----------------- FUNGSI BOT UTAMA (DIPANGGIL DARI SERVER.JS) -----------------

export const kirimNotifikasiOrtu = async (sock, nomor_ortu, nama_siswa, status) => {
    // Format nomor menjadi JID (628xxxx@s.whatsapp.net)
    const jid_ortu = nomor_ortu.replace(/[^0-9]/g, '') + '@s.whatsapp.net'; 

    let pesan = '';
    
    if (status === 'REGISTRASI') {
        pesan = `🎉 **Registrasi Berhasil!**\nAnanda *${nama_siswa}* telah berhasil didaftarkan ke sistem absensi. Wajah sudah tersimpan.`;
    } else if (status === 'ABSENSI') {
        const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        pesan = `🟢 **ABSENSI MASUK TERCATAT**\nAnanda *${nama_siswa}* telah berhasil absen masuk pada pukul *${waktu}*.`;
    }

    try {
        await sock.sendMessage(jid_ortu, { text: pesan });
        console.log(`[BOT WA SUCCESS] Notifikasi '${status}' terkirim ke Ortu: ${nomor_ortu}`);
    } catch (error) {
        console.error(`[BOT WA ERROR] Gagal mengirim pesan ke ${nomor_ortu}:`, error.message);
    }
};


// ----------------- INISIASI KONEKSI DENGAN PAIRING CODE -----------------

export async function connectToWhatsApp(PORT) {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, 
        browser: Browsers.macOS('Desktop'), 
        auth: state,
    });
    
    if (!sock.authState.creds.registered) {
        const botNumber = process.env.BOT_NUMBER; 
        
        if (!botNumber) {
            console.error("❌ BOT_NUMBER belum diatur. Scan QR Code di terminal.");
        } else {
            console.log(`\n🔑 Memulai Pairing Code untuk Nomor: ${botNumber}`);
            await delay(3000); 
            
            const code = await sock.requestPairingCode(botNumber);
            console.log(`\n==============================================`);
            console.log(`\nMasukkan kode ini di WA HP Anda: 👉 ${code} 👈`);
            console.log(`==============================================\n`);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Bot WhatsApp terhubung!');
            // Panggil startExpressServer yang ada di server.js
            if (global.startExpressServer) {
                global.startExpressServer(sock, PORT);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
    return sock; 
}


import express from "express";
import { distance } from "mathjs";
import { connectDB, User, Log } from "./db.js"; // Pastikan ada .js
import { connectToWhatsApp, kirimNotifikasiOrtu } from "./whatsapp-bot.js"; // Pastikan ada .js

const app = express();
app.use(express.json({ limit: '50mb' })); // Penting untuk data embedding
const PORT = process.env.PORT || 3000;

let waSock;

// Fungsi untuk memulai server Express (dipanggil setelah WA terhubung)
global.startExpressServer = (sock, port) => {
    if (waSock) return; 
    waSock = sock;
    app.listen(port, () => console.log(`🚀 API Server berjalan di http://localhost:${port}`));
};

// --- STARTUP UTAMA ---
connectDB()
    .then(() => {
        return connectToWhatsApp(PORT); 
    })
    .catch(err => {
        console.error("❌ Gagal memulai aplikasi:", err.message);
        process.exit(1);
    });

// --- ENPOINT API BOT WA ---

// Endpoint untuk registrasi wajah
app.post("/register", async (req, res) => {
    try {
        if (!waSock) throw new Error("Bot WhatsApp belum terhubung!");
        
        const { nama, noOrtu, embedding, nomor_siswa } = req.body || {};
        if (!nama || !noOrtu || !embedding || !nomor_siswa)
            return res.status(400).json({ message: "❌ Data tidak lengkap" });

        const newUser = await new User({ nama, noOrtu, embedding, nomor_wa: nomor_siswa }).save();
        
        // ** PANGGIL FUNGSI BOT WA **
        await kirimNotifikasiOrtu(waSock, newUser.noOrtu, newUser.nama, 'REGISTRASI'); 
        
        return res.json({ message: "✅ Registrasi berhasil! Notifikasi dikirim ke Ortu." });
    } catch (error) {
        console.error("Error Registrasi:", error.message);
        return res.status(500).json({ message: error.message || "Gagal registrasi" });
    }
});

// Endpoint untuk absen otomatis
app.post("/absen", async (req, res) => {
    try {
        if (!waSock) throw new Error("Bot WhatsApp belum terhubung!");
        
        const { embedding } = req.body || {};
        if (!embedding) return res.status(400).json({ message: "❌ Embedding tidak diterima" });

        const users = await User.find();
        if (!users.length) return res.status(404).json({ message: "❌ Belum ada data wajah terdaftar" });

        let bestMatch = null;
        let minDist = Infinity;
        const THRESHOLD = 0.6; 

        for (const u of users) {
            const dist = distance(u.embedding, embedding);
            if (dist < minDist) {
                minDist = dist;
                bestMatch = u;
            }
        }

        if (minDist < THRESHOLD && bestMatch) {
            await new Log({ nama: bestMatch.nama, keterangan: 'Absen Masuk' }).save();
            
            // ** PANGGIL FUNGSI BOT WA **
            await kirimNotifikasiOrtu(waSock, bestMatch.noOrtu, bestMatch.nama, 'ABSENSI');

            return res.json({ message: `✅ ${bestMatch.nama} absen! Notifikasi dikirim ke Ortu.`, nama: bestMatch.nama });
        } else {
             return res.status(401).json({ message: "❌ Wajah tidak dikenali!" });
        }
    } catch (error) {
        console.error("Error Absensi:", error.message);
        return res.status(500).json({ message: error.message || "Gagal absen" });
    }
});

// ... Tambahkan endpoint /riwayat dan /test jika diperlukan

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI belum diatur di .env");
  process.exit(1); 
}

// 1. Definisikan Skema dan Model
const userSchema = new mongoose.Schema({
  nomor_wa: { type: String, required: true, unique: true }, // Tambahkan nomor WA siswa
  nama: { type: String, required: true },
  noOrtu: { type: String, required: true },
  embedding: { type: [Number], required: true },
  tanggal_registrasi: { type: Date, default: Date.now },
});

const logSchema = new mongoose.Schema({
  nama: { type: String, required: true },
  waktu_absen: { type: Date, default: Date.now },
  keterangan: { type: String, default: 'Absen Masuk' } 
});

export const User = mongoose.model("User", userSchema);
export const Log = mongoose.model("Log", logSchema);

// 2. Fungsi Koneksi
export const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ MongoDB Atlas terhubung!");
    } catch (err) {
        console.error("❌ Gagal koneksi MongoDB:", err.message);
        throw err;
    }
};
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { distance } from "mathjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI belum diatur di .env");
  process.exit(1);
}

// Middleware
app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE"] }));
app.use(bodyParser.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

// MongoDB connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Schema
const userSchema = new mongoose.Schema({
  nama: String,
  noOrtu: String,
  embedding: [Number],
  tanggal: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

const logSchema = new mongoose.Schema({
  nama: String,
  waktu: { type: Date, default: Date.now },
});
const Log = mongoose.model("Log", logSchema);

// ---------------- REGISTER ----------------
app.post("/register", async (req, res) => {
  try {
    const { nama, noOrtu, embedding } = req.body;
    if (!nama || !noOrtu || !embedding)
      return res.status(400).json({ message: "❌ Data tidak lengkap" });

    const data = new User({ nama, noOrtu, embedding });
    await data.save();
    console.log(`✅ Wajah ${nama} berhasil diregistrasi`);
    res.json({ message: "✅ Data wajah berhasil disimpan!" });
  } catch (err) {
    console.error("❌ Error /register:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- ABSEN ----------------
app.post("/absen", async (req, res) => {
  try {
    const { embedding } = req.body;
    if (!embedding)
      return res.status(400).json({ message: "❌ Embedding tidak diterima" });

    const users = await User.find();
    if (!users.length)
      return res.status(404).json({ message: "❌ Belum ada data wajah terdaftar" });

    let bestMatch = null;
    let minDist = Infinity;

    for (const user of users) {
      const dist = distance(user.embedding, embedding);
      console.log(`🔍 Jarak wajah ${user.nama}: ${dist.toFixed(4)}`);
      if (dist < minDist) {
        minDist = dist;
        bestMatch = user;
      }
    }

    const THRESHOLD = 0.6;

    if (minDist < THRESHOLD) {
      console.log(`✅ Wajah dikenali: ${bestMatch.nama}`);
      await new Log({ nama: bestMatch.nama }).save();
      res.json({ message: `✅ Wajah dikenali: ${bestMatch.nama} — absensi tercatat!` });
    } else {
      res.json({ message: "❌ Wajah tidak dikenali!" });
    }
  } catch (err) {
    console.error("❌ Error /absen:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- RIWAYAT ----------------
app.get("/riwayat", async (req, res) => {
  try {
    const logs = await Log.find().sort({ waktu: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: "Gagal ambil riwayat" });
  }
});

// ---------------- HAPUS 1 DATA ----------------
app.delete("/hapus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Log.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json({ message: "🗑️ Data berhasil dihapus!" });
  } catch (err) {
    console.error("❌ Error /hapus:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------- HAPUS SEMUA ----------------
app.delete("/hapus-semua", async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ message: "🧹 Semua data riwayat berhasil dihapus!" });
  } catch (err) {
    console.error("❌ Error /hapus-semua:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server jalan di http://localhost:${PORT}`)
);

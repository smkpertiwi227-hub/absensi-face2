import mongoose from "mongoose";
import { distance } from "mathjs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Koneksi MongoDB (biar cuma sekali connect)
if (!global.mongooseConnection) {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) console.error("❌ MONGO_URI belum diatur di .env");
  else mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected"));
  global.mongooseConnection = mongoose.connection;
}

// ✅ Schema
const userSchema = new mongoose.Schema({
  nama: String,
  noOrtu: String,
  embedding: [Number],
  tanggal: { type: Date, default: Date.now },
});
const logSchema = new mongoose.Schema({
  nama: String,
  waktu: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Log = mongoose.models.Log || mongoose.model("Log", logSchema);

// ✅ Serverless API Handler (buat Vercel)
export default async function handler(req, res) {
  try {
    const { method, url } = req;

    // -------- REGISTER --------
    if (url.endsWith("/register") && method === "POST") {
      const { nama, noOrtu, embedding } = req.body || {};
      if (!nama || !noOrtu || !embedding)
        return res.status(400).json({ message: "❌ Data tidak lengkap" });

      await new User({ nama, noOrtu, embedding }).save();
      return res.json({ message: "✅ Wajah berhasil diregistrasi!" });
    }

    // -------- ABSEN --------
    if (url.endsWith("/absen") && method === "POST") {
      const { embedding } = req.body || {};
      if (!embedding)
        return res.status(400).json({ message: "❌ Embedding tidak diterima" });

      const users = await User.find();
      if (!users.length)
        return res.status(404).json({ message: "❌ Belum ada data wajah terdaftar" });

      let bestMatch = null;
      let minDist = Infinity;

      for (const u of users) {
        const dist = distance(u.embedding, embedding);
        if (dist < minDist) {
          minDist = dist;
          bestMatch = u;
        }
      }

      if (minDist < 0.6 && bestMatch) {
        await new Log({ nama: bestMatch.nama }).save();
        return res.json({ message: `✅ ${bestMatch.nama} absen!` });
      } else {
        return res.json({ message: "❌ Wajah tidak dikenali!" });
      }
    }

    // -------- RIWAYAT --------
    if (url.endsWith("/riwayat") && method === "GET") {
      const logs = await Log.find().sort({ waktu: -1 });
      return res.json(logs);
    }

    // -------- TEST --------
    if (url.endsWith("/test")) {
      return res.json({ message: "API berjalan dengan baik ✅" });
    }

    // Default jika endpoint tidak ditemukan
    res.status(404).json({ message: "❌ Endpoint tidak ditemukan" });
  } catch (err) {
    console.error("❌ API Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

import mongoose from "mongoose";
import { distance } from "mathjs";
import dotenv from "dotenv";

dotenv.config();

// ✅ Pastikan koneksi MongoDB hanya sekali (Vercel suka re-init tiap request)
if (!global.mongooseConnection) {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) console.error("❌ MONGO_URI belum diatur di .env");
  else mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected"));
  global.mongooseConnection = mongoose.connection;
}

// ✅ Schema dan Model
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

// ✅ Handler utama (Serverless function)
export default async function handler(req, res) {
  try {
    const { method, url } = req;

    // -------- REGISTER WAJAH --------
    if (url.endsWith("/register") && method === "POST") {
      const { nama, noOrtu, embedding } = req.body || {};
      if (!nama || !noOrtu || !embedding)
        return res.status(400).json({ message: "❌ Data tidak lengkap" });

      await new User({ nama, noOrtu, embedding }).save();
      return res.json({ message: "✅ Wajah berhasil diregistrasi!" });
    }

    // -------- ABSEN OTOMATIS --------
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

    // -------- LIHAT RIWAYAT --------
    if (url.endsWith("/riwayat") && method === "GET") {
      const logs = await Log.find().sort({ waktu: -1 });
      return res.json(logs);
    }

    // -------- HAPUS SATU DATA --------
    if (url.includes("/hapus/") && method === "DELETE") {
      const id = url.split("/hapus/")[1];
      if (!id) return res.status(400).json({ message: "❌ ID tidak ditemukan" });

      await Log.findByIdAndDelete(id);
      return res.json({ message: "✅ Data berhasil dihapus!" });
    }

    // -------- HAPUS SEMUA DATA --------
    if (url.endsWith("/hapus-semua") && method === "DELETE") {
      await Log.deleteMany();
      return res.json({ message: "✅ Semua data absensi berhasil dihapus!" });
    }

    // -------- TEST SERVER --------
    if (url.endsWith("/test") && method === "GET") {
      return res.json({ message: "✅ API berjalan dengan baik!" });
    }

    // Default handler kalau endpoint gak dikenal
    res.status(404).json({ message: "❌ Endpoint tidak ditemukan" });
  } catch (err) {
    console.error("❌ API Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

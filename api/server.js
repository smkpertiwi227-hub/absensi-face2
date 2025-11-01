import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import { distance } from "mathjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(bodyParser.json({ limit: "20mb" }));
app.use(express.static("public"));

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI belum diatur di .env");
}

mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected"));

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
const User = mongoose.model("User", userSchema);
const Log = mongoose.model("Log", logSchema);

app.post("/register", async (req, res) => {
  const { nama, noOrtu, embedding } = req.body;
  if (!nama || !noOrtu || !embedding)
    return res.status(400).json({ message: "Data tidak lengkap" });

  await new User({ nama, noOrtu, embedding }).save();
  res.json({ message: "✅ Wajah berhasil diregistrasi!" });
});

app.post("/absen", async (req, res) => {
  const { embedding } = req.body;
  const users = await User.find();
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
  }
  res.json({ message: "❌ Wajah tidak dikenali!" });
});

app.get("/riwayat", async (req, res) => {
  const logs = await Log.find().sort({ waktu: -1 });
  res.json(logs);
});

export default app;

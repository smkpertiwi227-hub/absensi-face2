document.addEventListener("DOMContentLoaded", () => loadModels());

async function loadModels() {
  const statusEl = document.getElementById("status");
  statusEl.textContent = "📦 Memuat model...";

  try {
    const MODEL_URL = `${window.location.origin}/models`;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    statusEl.textContent = "✅ Model siap, mengaktifkan kamera...";
    startCamera();
  } catch (err) {
    statusEl.textContent = "❌ Gagal memuat model: " + err.message;
    console.error("Model load error:", err);
  }
}

async function startCamera() {
  const video = document.getElementById("video");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      document.getElementById("status").textContent =
        "📷 Kamera aktif, siap mendeteksi wajah...";
      autoAbsenLoop(video);
    };
  } catch (err) {
    document.getElementById("status").textContent =
      "❌ Gagal akses kamera: " + err.message;
    console.error(err);
  }
}

async function captureFace(video) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  try {
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection;
  } catch (err) {
    console.error("Face capture error:", err);
    return null;
  }
}

async function registerFace() {
  const nama = prompt("Nama siswa:");
  const noOrtu = prompt("Nomor WA orang tua:");
  if (!nama || !noOrtu) return alert("Isi semua data dulu!");

  const statusEl = document.getElementById("status");
  statusEl.textContent = "🔍 Mendeteksi wajah...";

  const video = document.getElementById("video");
  const detection = await captureFace(video);

  if (!detection) return alert("❌ Wajah tidak terdeteksi!");

  const embedding = Array.from(detection.descriptor);

  try {
    // ✅ gunakan /api/register (bukan /register)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, noOrtu, embedding }),
    });

    const result = await res.json();
    alert(result.message);
    statusEl.textContent = result.message;
  } catch (err) {
    console.error("❌ Error register:", err);
    alert("Gagal mengirim data ke server.");
  }
}

let lastRecognized = 0;
let isProcessing = false;

async function autoAbsenLoop(video) {
  const statusEl = document.getElementById("status");

  if (isProcessing) {
    requestAnimationFrame(() => autoAbsenLoop(video));
    return;
  }

  isProcessing = true;

  try {
    const detection = await captureFace(video);

    if (detection) {
      const now = Date.now();
      if (now - lastRecognized > 5000) { // cooldown 5 detik
        const embedding = Array.from(detection.descriptor);

        // ✅ gunakan /api/absen
        const res = await fetch("/api/absen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedding }),
        });

        const result = await res.json();
        statusEl.textContent = result.message;
        console.log(result.message);
        lastRecognized = now;
      }
    }
  } catch (err) {
    console.error("❌ Auto absen error:", err);
  }

  isProcessing = false;
  requestAnimationFrame(() => autoAbsenLoop(video));
}

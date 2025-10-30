document.addEventListener("DOMContentLoaded", () => loadModels());

async function loadModels() {
  document.getElementById("status").textContent = "📦 Memuat model...";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  ]);
  document.getElementById("status").textContent = "✅ Model siap, mengaktifkan kamera...";
  startCamera();
}

async function startCamera() {
  const video = document.getElementById("video");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    document.getElementById("status").textContent = "📷 Kamera aktif, siap mendeteksi wajah...";
    autoAbsen(); // auto scan setiap beberapa detik
  } catch (err) {
    document.getElementById("status").textContent = "❌ Gagal akses kamera: " + err.message;
  }
}

async function captureFace() {
  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return await faceapi
    .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
}

async function registerFace() {
  const nama = prompt("Nama siswa:");
  const noOrtu = prompt("Nomor WA orang tua:");
  if (!nama || !noOrtu) return alert("Isi semua data dulu!");

  document.getElementById("status").textContent = "🔍 Mendeteksi wajah...";
  const detection = await captureFace();
  if (!detection) return alert("Wajah tidak terdeteksi!");

  const embedding = Array.from(detection.descriptor);
  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama, noOrtu, embedding }),
  });

  const result = await res.json();
  alert(result.message);
  document.getElementById("status").textContent = result.message;
}

async function autoAbsen() {
  setInterval(async () => {
    const detection = await captureFace();
    if (!detection) return;

    const embedding = Array.from(detection.descriptor);
    const res = await fetch("/absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embedding }),
    });

    const result = await res.json();
    if (result.message.includes("✅")) {
      document.getElementById("status").textContent = result.message;
    }
  }, 5000); // scan setiap 5 detik
}

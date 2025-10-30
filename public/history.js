document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.getElementById("tabel-riwayat");
  const status = document.getElementById("status");

  try {
    const res = await fetch("/riwayat");
    const data = await res.json();

    if (data.length === 0) {
      status.textContent = "Belum ada data absensi.";
      return;
    }

    status.textContent = "";

    data.forEach((item, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border py-2 text-center">${i + 1}</td>
        <td class="border py-2 text-center">${item.nama}</td>
        <td class="border py-2 text-center">${new Date(item.waktu).toLocaleString("id-ID")}</td>
        <td class="border py-2 text-center">
          <button onclick="hapusData('${item._id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-sm">
            🗑️ Hapus
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Gagal ambil riwayat:", err);
    status.textContent = "❌ Gagal memuat data.";
  }
});

async function hapusData(id) {
  if (!confirm("Yakin ingin menghapus data ini?")) return;

  try {
    const res = await fetch(`/hapus/${id}`, { method: "DELETE" });
    const result = await res.json();
    alert(result.message);
    location.reload();
  } catch (err) {
    console.error("Gagal hapus data:", err);
    alert("❌ Gagal menghapus data.");
  }
}

async function hapusSemua() {
  if (!confirm("Yakin ingin menghapus semua riwayat absensi?")) return;

  try {
    const res = await fetch(`/hapus-semua`, { method: "DELETE" });
    const result = await res.json();
    alert(result.message);
    location.reload();
  } catch (err) {
    console.error("Gagal hapus semua data:", err);
    alert("❌ Gagal menghapus semua data.");
  }
}

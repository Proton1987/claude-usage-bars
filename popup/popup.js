// เก็บเป็น Object เพื่อแยก ID ตัวนับเวลาของแต่ละบาร์ ไม่ให้ตีกันเอง
let activeIntervals = {
  current: null,
  weekly: null,
};

function updateCountdown(isoString, elementId, intervalKey) {
  // ล้าง Interval เก่าเฉพาะของช่องนั้นๆ ก่อนเริ่มนับใหม่ ป้องกันการวิ่งซ้อนกัน
  if (activeIntervals[intervalKey]) {
    clearInterval(activeIntervals[intervalKey]);
  }

  if (!isoString) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = "—";
    return;
  }

  const targetTime = new Date(isoString).getTime();

  function refreshTime() {
    const el = document.getElementById(elementId);
    if (!el) return; // หากไม่พบ element ให้หยุดทำงาน

    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      el.textContent = "รีเซ็ตแล้ว กำลังอัปเดต...";
      clearInterval(activeIntervals[intervalKey]);
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (num) => String(num).padStart(2, "0");
    el.textContent = `รีเซ็ตในอีก ${pad(hours)}ช ${pad(minutes)}ม ${pad(seconds)}ว`;
  }

  refreshTime();
  activeIntervals[intervalKey] = setInterval(refreshTime, 1000);
}

function applyBar(fillEl, pctEl, rowEl, pct) {
  const value = Math.max(0, Math.min(100, Math.round(pct ?? 0)));

  // Safe Check: ตรวจสอบความปลอดภัยก่อนใช้คำสั่งควบคุมสไตล์ ป้องกัน Uncaught TypeError
  if (fillEl) fillEl.style.width = `${value}%`;
  if (pctEl) pctEl.textContent = `${value}%`;
  if (rowEl) rowEl.classList.toggle("warn", value >= 90);
}

async function render() {
  const { usageData, usageError, lastUpdated } = await chrome.storage.local.get(
    ["usageData", "usageError", "lastUpdated"],
  );

  const updatedEl = document.getElementById("updated");
  const errorContainer = document.getElementById("error-container");
  const mainContent = document.getElementById("main-content");

  // จัดการหน้าต่างเคส Error (Graceful Error Handling)
  if (usageError === "logged_out" || usageError?.includes("Status: 403")) {
    if (mainContent) mainContent.style.display = "none";
    if (errorContainer) errorContainer.style.display = "flex";
    return;
  }

  if (mainContent) mainContent.style.display = "block";
  if (errorContainer) errorContainer.style.display = "none";

  if (usageError) {
    if (updatedEl) updatedEl.textContent = `Error: ${usageError}`;
    return;
  }

  if (!usageData) {
    if (updatedEl) updatedEl.textContent = "กำลังโหลด...";
    return;
  }

  const fiveHour = usageData.five_hour ?? {};
  const sevenDay = usageData.seven_day ?? {};

  const barCurrent = document.getElementById("bar-current");
  const barWeekly = document.getElementById("bar-weekly");

  // แสดงผลหลอดความจุด้วยข้อมูลจริง ค้นหา .metric อัตโนมัติจากโค้ดเบื้องหลัง
  applyBar(
    barCurrent,
    document.getElementById("pct-current"),
    barCurrent ? barCurrent.closest(".metric") : null,
    fiveHour.utilization,
  );

  applyBar(
    barWeekly,
    document.getElementById("pct-weekly"),
    barWeekly ? barWeekly.closest(".metric") : null,
    sevenDay.utilization,
  );

  // สั่งระบบนับเวลาถอยหลังแบบเรียลไทม์
  updateCountdown(fiveHour.resets_at, "reset-current", "current");
  updateCountdown(sevenDay.resets_at, "reset-weekly", "weekly");

  if (updatedEl) {
    updatedEl.textContent = lastUpdated
      ? `อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
      : "—";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  render();

  // จัดการเหตุการณ์เมื่อคลิกปุ่มไปหน้าล็อกอิน
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://claude.ai/" });
    });
  }

  // จัดการปุ่มกด Manual Refresh คลุมด้วยเอฟเฟกต์แอนิเมชันหมุน
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.classList.add("spinning");
      chrome.runtime.sendMessage({ type: "force-poll" }).then(() => {
        render();
        setTimeout(() => refreshBtn.classList.remove("spinning"), 600);
      });
    });
  }

  chrome.runtime.sendMessage({ type: "force-poll" }).then(() => render());
});

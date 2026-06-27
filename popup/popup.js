let activeIntervals = {
  current: null,
  weekly: null,
};

const FRESH_MS = 90 * 1000;
const STALE_MS = 5 * 60 * 1000;

// ── HISTORY SPARKLINE ────────────────────────────────────────────────────────
const MAX_HISTORY = 60; // เก็บ 60 snapshots = 1 ชั่วโมงที่ poll ทุก 1 นาที

async function saveSnapshot(pct) {
  if (pct === null || pct === undefined) return;
  const { usageHistory = [] } = await chrome.storage.local.get("usageHistory");
  usageHistory.push({ t: Date.now(), v: pct });
  // rolling window — เก็บแค่ MAX_HISTORY จุดล่าสุด
  if (usageHistory.length > MAX_HISTORY)
    usageHistory.splice(0, usageHistory.length - MAX_HISTORY);
  await chrome.storage.local.set({ usageHistory });
}

function renderSparkline(canvasEl, history) {
  if (!canvasEl || !history || history.length < 2) return;
  const ctx = canvasEl.getContext("2d");
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  const values = history.map((p) => p.v);
  const max = Math.max(...values, 1);

  // gradient fill under the line
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(226,137,90,0.35)");
  grad.addColorStop(1, "rgba(226,137,90,0)");

  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / 100) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  // close fill path
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // line on top
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / 100) * h;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#e2895a";
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.stroke();

  // dot at latest value
  const lastX = w;
  const lastY = h - (values[values.length - 1] / 100) * h;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#f5ac80";
  ctx.fill();
}

// ── COUNTDOWN ────────────────────────────────────────────────────────────────
function updateCountdown(isoString, elementId, intervalKey) {
  if (activeIntervals[intervalKey]) clearInterval(activeIntervals[intervalKey]);

  if (!isoString) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = "—";
    return;
  }

  const targetTime = new Date(isoString).getTime();

  function refreshTime() {
    const el = document.getElementById(elementId);
    if (!el) return;
    const diff = targetTime - Date.now();
    if (diff <= 0) {
      el.textContent = "รีเซ็ตแล้ว กำลังอัปเดต...";
      clearInterval(activeIntervals[intervalKey]);
      return;
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    el.textContent = `รีเซ็ตในอีก ${pad(hours)}ช ${pad(minutes)}ม ${pad(seconds)}ว`;
  }

  refreshTime();
  activeIntervals[intervalKey] = setInterval(refreshTime, 1000);
}

// ── BAR ───────────────────────────────────────────────────────────────────────
function applyBar(fillEl, pctEl, rowEl, pct) {
  const value = Math.max(0, Math.min(100, Math.round(pct ?? 0)));
  if (fillEl) fillEl.style.width = `${value}%`;
  if (pctEl) pctEl.textContent = `${value}%`;
  if (rowEl) rowEl.classList.toggle("warn", value >= 90);
}

// ── SYNC DOT ─────────────────────────────────────────────────────────────────
async function updateSyncStatus() {
  const dot = document.getElementById("sync-dot");
  if (!dot) return;
  const { usageError, lastUpdated } = await chrome.storage.local.get([
    "usageError",
    "lastUpdated",
  ]);
  dot.classList.remove("fresh", "stale", "error");
  if (usageError) {
    dot.classList.add("error");
    return;
  }
  if (!lastUpdated) return;
  const age = Date.now() - lastUpdated;
  if (age < FRESH_MS) dot.classList.add("fresh");
  else if (age < STALE_MS) dot.classList.add("stale");
  else dot.classList.add("error");
}

// ── RENDER ────────────────────────────────────────────────────────────────────
async function render() {
  updateSyncStatus();

  const {
    usageData,
    usageError,
    lastUpdated,
    usageHistory = [],
  } = await chrome.storage.local.get([
    "usageData",
    "usageError",
    "lastUpdated",
    "usageHistory",
  ]);

  const updatedEl = document.getElementById("updated");
  const errorContainer = document.getElementById("error-container");
  const mainContent = document.getElementById("main-content");

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

  updateCountdown(fiveHour.resets_at, "reset-current", "current");
  updateCountdown(sevenDay.resets_at, "reset-weekly", "weekly");

  // sparkline
  const canvas = document.getElementById("sparkline");
  renderSparkline(canvas, usageHistory);

  if (updatedEl) {
    updatedEl.textContent = lastUpdated
      ? `อัปเดตล่าสุด ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
      : "—";
  }
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  render();
  setInterval(updateSyncStatus, 15000);

  document.getElementById("login-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://claude.ai/" });
  });

  document.getElementById("settings-btn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

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

// keyboard shortcut handler — Alt+Shift+U เปิด popup ผ่าน commands API
chrome.commands?.onCommand?.addListener((command) => {
  if (command === "open-popup") chrome.action.openPopup?.();
});

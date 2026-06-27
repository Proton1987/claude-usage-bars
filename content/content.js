(function () {
  if (window.__claudeUsageWidgetInjected) return;
  window.__claudeUsageWidgetInjected = true;

  const FRESH_MS = 90 * 1000;
  const STALE_MS = 5 * 60 * 1000;

  // ---------- host + shadow root ----------

  const host = document.createElement("div");
  host.id = "claude-usage-floating-host";
  Object.assign(host.style, {
    position: "fixed",
    right: "-1px", // ดันให้ขอบขวาแอบใต้ขอบจอนิดเดียว กันเส้น border/radius โผล่
    bottom: "120px",
    zIndex: "2147483647",
  });

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    /* ── dark (default) ── */
    :host {
      --bg-deep: #15100c;
      --border-soft: rgba(255, 255, 255, 0.08);
      --track-bg: rgba(255, 255, 255, 0.06);

      --text-primary: #f4ede5;
      --text-muted: #9c8e80;
      --text-dim: #7c7064;

      --ember: #e2895a;
      --ember-bright: #f5ac80;
      --ember-glow: rgba(226, 137, 90, 0.45);

      --steel: #4fa8a2;
      --steel-bright: #7ad0c9;
      --steel-glow: rgba(79, 168, 162, 0.4);

      --warn: #ff5c46;
      --warn-bright: #ff8166;
      --warn-glow: rgba(255, 92, 70, 0.5);

      all: initial;
    }

    /* ── light: OS preference ── */
    @media (prefers-color-scheme: light) {
      :host(.cu-theme-light) {
        --bg-deep: #faf8f5;
        --border-soft: rgba(0, 0, 0, 0.08);
        --track-bg: rgba(0, 0, 0, 0.05);

        --text-primary: #2c1f14;
        --text-muted: #6b5c50;
        --text-dim: #a09080;

        --ember: #c96830;
        --ember-bright: #e2895a;
        --ember-glow: rgba(201, 104, 48, 0.3);

        --steel: #2d8c86;
        --steel-bright: #4fa8a2;
        --steel-glow: rgba(45, 140, 134, 0.3);

        --warn: #d93a26;
        --warn-bright: #ff5c46;
        --warn-glow: rgba(217, 58, 38, 0.35);
      }
    }

    /* ── light: claude.ai ใส่ class บน <html> ── */
    :host(.cu-theme-light) {
      --bg-deep: #faf8f5;
      --border-soft: rgba(0, 0, 0, 0.08);
      --track-bg: rgba(0, 0, 0, 0.05);

      --text-primary: #2c1f14;
      --text-muted: #6b5c50;
      --text-dim: #a09080;

      --ember: #c96830;
      --ember-bright: #e2895a;
      --ember-glow: rgba(201, 104, 48, 0.3);

      --steel: #2d8c86;
      --steel-bright: #4fa8a2;
      --steel-glow: rgba(45, 140, 134, 0.3);

      --warn: #d93a26;
      --warn-bright: #ff5c46;
      --warn-glow: rgba(217, 58, 38, 0.35);
    }

    .cu-root {
      font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 12px;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      -webkit-font-smoothing: antialiased;
    }

    button {
      font: inherit;
      color: inherit;
    }

    /* ---------- collapsed: edge tab ---------- */

    .cu-tab {
      position: relative;
      width: 30px;
      padding: 12px 0 10px;
      background: var(--bg-deep);
      border: 1px solid var(--border-soft);
      border-right: none;
      border-radius: 10px 0 0 10px;
      box-shadow: -6px 4px 18px rgba(0, 0, 0, 0.4);
      cursor: grab;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      touch-action: none;
    }

    .cu-tab:active {
      cursor: grabbing;
    }

    .cu-tab::before {
      content: "";
      position: absolute;
      left: 0;
      top: 10px;
      bottom: 10px;
      width: 3px;
      border-radius: 2px;
      background: var(--ember);
      transition: background 0.25s ease;
    }

    .cu-tab.cu-warn::before {
      background: var(--warn);
    }

    .cu-tab-label {
      writing-mode: vertical-rl;
      font-size: 8px;
      letter-spacing: 0.14em;
      color: var(--text-dim);
      font-weight: 600;
    }

    .cu-tab-value {
      font-size: 12px;
      font-weight: 700;
      color: var(--ember);
      transition: color 0.25s ease;
    }

    .cu-tab.cu-warn .cu-tab-value {
      color: var(--warn);
    }

    /* ---------- พลิกหน้าตาแท็บเมื่ออยู่ฝั่งซ้าย ---------- */

    /* สลับมุมโค้งมนมาอยู่ฝั่งขวา และเปิด Border ฝั่งขวาแทน */
        .cu-tab.cu-left-side {
          border-radius: 0 10px 10px 0;
          border-left: none;
          border-right: 1px solid var(--border-soft);
          box-shadow: 6px 4px 18px rgba(0, 0, 0, 0.4);
        }

        /* สลับขีดสีส้ม (Ember) มาอยู่ฝั่งขวาของแท็บแทน */
        .cu-tab.cu-left-side::before {
          left: auto;
          right: 0;
        }

        /* [ปุ่มเล็ก] สลับมุมโค้งมนมาอยู่ฝั่งขวา และเปิด Border ฝั่งขวาแทน */
            .cu-tab.cu-left-side {
              border-radius: 0 10px 10px 0;
              border-left: none;
              border-right: 1px solid var(--border-soft);
              box-shadow: 6px 4px 18px rgba(0, 0, 0, 0.4);
            }

            /* [ปุ่มเล็ก] สลับขีดสีส้ม (Ember) มาอยู่ฝั่งขวาของแท็บแทน */
            .cu-tab.cu-left-side::before {
              left: auto;
              right: 0;
            }

            /* 🛠️ [แผงใหญ่] สลับมุมโค้งมนและย้ายแถบสีมาฝั่งขวาเพื่อให้แนบขอบจอซ้ายได้เนียนตา */
            .cu-panel.cu-left-side {
              border-radius: 0 12px 12px 0;
              border-left: none;
              border-right: 1px solid var(--border-soft);
              box-shadow: 10px 8px 32px rgba(0, 0, 0, 0.5);
            }
    /* ---------- expanded panel ---------- */

    .cu-panel {
      width: 232px;
      background: var(--bg-deep);
      border: 1px solid var(--border-soft);
      border-right: none;
      border-radius: 12px 0 0 12px;
      box-shadow: -10px 8px 32px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }

    .cu-panel::before {
      content: "";
      display: block;
      height: 2px;
      background: linear-gradient(90deg, var(--ember), var(--steel));
    }

    .cu-panel-head {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 9px 8px 9px 10px;
      cursor: grab;
      touch-action: none;
      border-bottom: 1px solid var(--border-soft);
    }

    .cu-panel-head:active {
      cursor: grabbing;
    }

    .cu-grip {
      display: flex;
      color: var(--text-dim);
      flex-shrink: 0;
    }

    .cu-grip svg {
      width: 14px;
      height: 14px;
    }

    .cu-title {
      flex: 1;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.12em;
      color: var(--text-muted);
    }

    .cu-head-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .cu-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease;
    }

    .cu-icon-btn svg {
      width: 12px;
      height: 12px;
    }

    .cu-icon-btn:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--ember-bright);
    }

    .cu-icon-btn.cu-spinning svg {
      animation: cu-spin 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cu-body {
      padding: 12px 14px 4px;
    }

    .cu-metric {
      --tone: var(--ember);
      --tone-bright: var(--ember-bright);
      --tone-glow: var(--ember-glow);
    }

    .cu-metric[data-tone="steel"] {
      --tone: var(--steel);
      --tone-bright: var(--steel-bright);
      --tone-glow: var(--steel-glow);
    }

    .cu-metric.cu-warn {
      --tone: var(--warn);
      --tone-bright: var(--warn-bright);
      --tone-glow: var(--warn-glow);
    }

    .cu-metric-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .cu-metric-label {
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.07em;
      color: var(--text-muted);
    }

    .cu-metric-sub {
      color: var(--text-dim);
      font-weight: 500;
    }

    .cu-metric-value {
      font-size: 14px;
      font-weight: 700;
      color: var(--tone);
    }

    .cu-track {
      height: 6px;
      border-radius: 999px;
      background: var(--track-bg);
      border: 1px solid var(--border-soft);
      overflow: hidden;
    }

    .cu-fill {
      height: 100%;
      width: 0%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--tone), var(--tone-bright));
      box-shadow: 0 0 6px var(--tone-glow);
      transition: width 0.4s ease, background 0.25s ease;
    }

    .cu-metric-foot {
      margin-top: 4px;
      font-size: 9px;
      color: var(--text-dim);
    }

    .cu-divider {
      height: 1px;
      background: var(--border-soft);
      margin: 10px 0;
    }

    .cu-error {
      padding: 14px;
      text-align: center;
    }

    .cu-error-text {
      font-size: 10.5px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .cu-footer {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 8px 14px 10px;
    }

    .cu-sync-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--text-dim);
      flex-shrink: 0;
    }

    .cu-sync-dot.cu-fresh {
      background: var(--steel-bright);
      box-shadow: 0 0 5px var(--steel-glow);
      animation: cu-pulse 2.4s ease-in-out infinite;
    }

    .cu-sync-dot.cu-stale {
      background: var(--ember);
      box-shadow: 0 0 4px var(--ember-glow);
    }

    .cu-sync-dot.cu-error {
      background: var(--warn);
      box-shadow: 0 0 5px var(--warn-glow);
      animation: cu-pulse 1.1s ease-in-out infinite;
    }

    .cu-updated {
      font-size: 9.5px;
      color: var(--text-dim);
    }

    [hidden] {
      display: none !important;
    }

    @keyframes cu-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    @keyframes cu-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "cu-root";
  root.innerHTML = `
    <button class="cu-tab" id="cu-tab" type="button" aria-label="เปิด Claude Usage">
      <span class="cu-tab-label">USAGE</span>
      <span class="cu-tab-value" id="cu-tab-value">--</span>
    </button>

    <div class="cu-panel" id="cu-panel" hidden>
      <div class="cu-panel-head" id="cu-panel-head">
        <span class="cu-grip" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="8" cy="6" r="1.4" /><circle cx="16" cy="6" r="1.4" />
            <circle cx="8" cy="12" r="1.4" /><circle cx="16" cy="12" r="1.4" />
            <circle cx="8" cy="18" r="1.4" /><circle cx="16" cy="18" r="1.4" />
          </svg>
        </span>
        <span class="cu-title">USAGE</span>
        <div class="cu-head-actions">
          <button class="cu-icon-btn" id="cu-refresh" type="button" title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" /><path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" /><path d="M3 21v-5h5" />
            </svg>
          </button>
          <button class="cu-icon-btn" id="cu-collapse" type="button" title="ย่อ" aria-label="ย่อ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13H6" />
            </svg>
          </button>
        </div>
      </div>

      <div class="cu-body" id="cu-body">
        <div class="cu-metric" data-tone="ember">
          <div class="cu-metric-head">
            <span class="cu-metric-label">CURRENT <span class="cu-metric-sub">5H</span></span>
            <span class="cu-metric-value" id="cu-pct-current">--%</span>
          </div>
          <div class="cu-track"><div class="cu-fill" id="cu-bar-current"></div></div>
          <div class="cu-metric-foot" id="cu-reset-current">—</div>
        </div>

        <div class="cu-divider"></div>

        <div class="cu-metric" data-tone="steel">
          <div class="cu-metric-head">
            <span class="cu-metric-label">WEEKLY <span class="cu-metric-sub">7D</span></span>
            <span class="cu-metric-value" id="cu-pct-weekly">--%</span>
          </div>
          <div class="cu-track"><div class="cu-fill" id="cu-bar-weekly"></div></div>
          <div class="cu-metric-foot" id="cu-reset-weekly">—</div>
        </div>
      </div>

      <div class="cu-error" id="cu-error" hidden>
        <div class="cu-error-text">ไม่พบข้อมูลโควตา ลองรีเฟรชหน้าเว็บ claude.ai</div>
      </div>

      <div class="cu-footer">
        <span class="cu-sync-dot" id="cu-sync-dot"></span>
        <span class="cu-updated" id="cu-updated">—</span>
      </div>
    </div>
  `;
  shadow.appendChild(root);

  // ---------- element refs ----------
  // 🛠️ แก้ไขเรียบร้อย: สลับจาก root.getElementById ไปใช้ shadow.getElementById เพื่อดึงค่าจากภายใน Shadow DOM ได้ถูกต้อง ไม่ระเบิดพัง

  const tabEl = shadow.getElementById("cu-tab");
  const tabValueEl = shadow.getElementById("cu-tab-value");
  const panelEl = shadow.getElementById("cu-panel");
  const panelHeadEl = shadow.getElementById("cu-panel-head");
  const refreshBtn = shadow.getElementById("cu-refresh");
  const collapseBtn = shadow.getElementById("cu-collapse");
  const bodyEl = shadow.getElementById("cu-body");
  const errorEl = shadow.getElementById("cu-error");
  const barCurrentEl = shadow.getElementById("cu-bar-current");
  const pctCurrentEl = shadow.getElementById("cu-pct-current");
  const resetCurrentEl = shadow.getElementById("cu-reset-current");
  const barWeeklyEl = shadow.getElementById("cu-bar-weekly");
  const pctWeeklyEl = shadow.getElementById("cu-pct-weekly");
  const resetWeeklyEl = shadow.getElementById("cu-reset-weekly");
  const updatedEl = shadow.getElementById("cu-updated");
  const syncDotEl = shadow.getElementById("cu-sync-dot");

  // ---------- drag: ปลดล็อคให้ลากได้อิสระเต็มจอ + พลิกหน้าตาแท็บตามพิกัด (Smooth ไม่เด้งเข้า) ----------

  // ---------- drag: ลากอิสระเต็มจอ + สลับ Anchor + รีเซ็ตพิกัดให้ลากต่อได้เรื่อยๆ ----------

  function makeDraggable(handleEl) {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;

    handleEl.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".cu-icon-btn")) return;

      const rect = host.getBoundingClientRect();

      // 🛠️ จุดแก้ไขสำคัญ: ก่อนจะคำนวณลากรอบใหม่ ให้แปลงพิกัดปัจจุบันกลับมาเป็นระบบ right เสมอ
      // และล้างค่า style.left ทิ้งทันที เพื่อให้ฟังก์ชันเคลื่อนที่ (pointermove) ทำงานได้อย่างถูกต้อง ไม่เอ๋อค้าง
      host.style.right = `${window.innerWidth - rect.right}px`;
      host.style.left = "auto";

      // บันทึกตำแหน่งจุดเริ่มต้นใหม่จากขวาและล่าง
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;

      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      dragging = true;
      handleEl.setPointerCapture(e.pointerId);
    });

    handleEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;

      const rect = host.getBoundingClientRect();

      // คำนวณระยะเคลื่อนที่ตามมืออย่างอิสระ
      const maxRight = Math.max(window.innerWidth - rect.width, 0);
      const nextRight = Math.min(Math.max(startRight - dx, -10), maxRight);

      const maxBottom = Math.max(window.innerHeight - rect.height, 0);
      const nextBottom = Math.min(Math.max(startBottom - dy, 0), maxBottom);

      host.style.right = `${nextRight}px`;
      host.style.bottom = `${nextBottom}px`;

      // เช็กฝั่งจอเพื่อเปลี่ยนหน้าตา CSS (Class) แบบเรียลไทม์ขณะลาก
      const widgetCenterX = rect.left + rect.width / 2;
      const isLeftSide = widgetCenterX < window.innerWidth / 2;

      const panelEl = shadow.getElementById("cu-panel");

      if (isLeftSide) {
        tabEl.classList.add("cu-left-side");
        if (panelEl) panelEl.classList.add("cu-left-side");
      } else {
        tabEl.classList.remove("cu-left-side");
        if (panelEl) panelEl.classList.remove("cu-left-side");
      }
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      handleEl.releasePointerCapture?.(e.pointerId);

      const rect = host.getBoundingClientRect();
      const widgetCenterX = rect.left + rect.width / 2;
      const isLeftSide = widgetCenterX < window.innerWidth / 2;

      // สลับ Anchor ตอนปล่อยนิ้ว เพื่อให้แผงใหญ่กางเข้าหาจอได้อย่างถูกต้อง
      if (isLeftSide) {
        host.style.left = `${rect.left}px`;
        host.style.right = "auto";
      } else {
        host.style.right = `${window.innerWidth - rect.right}px`;
        host.style.left = "auto";
      }
    };

    handleEl.addEventListener("pointerup", endDrag);
    handleEl.addEventListener("pointercancel", endDrag);

    return () => moved;
  }

  const tabMoved = makeDraggable(tabEl);
  makeDraggable(panelHeadEl);

  // คลิกที่แท็บเพื่อขยาย เว้นแต่กำลังลากอยู่ (กันลากแล้วโดน trigger ขยายโดยไม่ตั้งใจ)
  tabEl.addEventListener("click", () => {
    if (tabMoved()) return;
    tabEl.hidden = true;
    panelEl.hidden = false;
  });

  collapseBtn.addEventListener("click", () => {
    panelEl.hidden = true;
    tabEl.hidden = false;
  });

  refreshBtn.addEventListener("click", () => {
    refreshBtn.classList.add("cu-spinning");
    chrome.runtime.sendMessage({ type: "force-poll" }).then(() => {
      render();
      setTimeout(() => refreshBtn.classList.remove("cu-spinning"), 600);
    });
  });

  root.addEventListener("dragstart", (e) => e.preventDefault());

  // ---------- countdown ----------

  const activeIntervals = { current: null, weekly: null };

  function updateCountdown(isoString, el, intervalKey) {
    if (activeIntervals[intervalKey])
      clearInterval(activeIntervals[intervalKey]);

    if (!isoString) {
      if (el) el.textContent = "—";
      return;
    }

    const targetTime = new Date(isoString).getTime();

    function tick() {
      if (!el || !el.isConnected) {
        clearInterval(activeIntervals[intervalKey]);
        return;
      }
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        el.textContent = "รีเซ็ตแล้ว";
        clearInterval(activeIntervals[intervalKey]);
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const pad = (n) => String(n).padStart(2, "0");
      el.textContent = `รีเซ็ตในอีก ${pad(hours)}ช ${pad(minutes)}ม`;
    }

    tick();
    // widget นี้ลอยอยู่ตลอด ใช้รอบ 30 วิแทนทุกวิ ประหยัด CPU ของหน้าเว็บ
    activeIntervals[intervalKey] = setInterval(tick, 30 * 1000);
  }

  // ---------- render ----------

  function applyBar(fillEl, pctEl, rowEl, pct) {
    const value = Math.max(0, Math.min(100, Math.round(pct ?? 0)));
    if (fillEl) fillEl.style.width = `${value}%`;
    if (pctEl) pctEl.textContent = `${value}%`;
    if (rowEl) rowEl.classList.toggle("cu-warn", value >= 90);
  }

  function updateSyncDot(usageError, lastUpdated) {
    syncDotEl.classList.remove("cu-fresh", "cu-stale", "cu-error");
    if (usageError) {
      syncDotEl.classList.add("cu-error");
      return;
    }
    if (!lastUpdated) return;

    const age = Date.now() - lastUpdated;
    if (age < FRESH_MS) syncDotEl.classList.add("cu-fresh");
    else if (age < STALE_MS) syncDotEl.classList.add("cu-stale");
    else syncDotEl.classList.add("cu-error");
  }

  // ฟังก์ชันล้างตัวนับเวลา (Interval) บนหน้าเว็บทิ้งเมื่อท่อหลุด เพื่อประหยัด CPU ของบราวเซอร์
  function cleanup() {
    if (activeIntervals.current) clearInterval(activeIntervals.current);
    if (activeIntervals.weekly) clearInterval(activeIntervals.weekly);
    // ซ่อนตัว Widget ไปเนียนๆ เพราะ Extension โดนรีโหลดไปแล้ว
    if (host) host.style.display = "none";
  }

  async function render() {
    // 1. ตรวจสอบก่อนเลยว่า Context ของ Extension ยังอยู่ไหม ถ้าไม่อยู่แล้วให้หยุดทำงานทันที ป้องกัน Error ตั้งแต่ต้นทาง
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log(
        "[Claude Extension] Extension context invalidated. Stopping background tasks.",
      );
      cleanup();
      return;
    }

    try {
      // 2. ครอบส่วนดึงข้อมูลและจัดการ UI ไว้ใน try เพื่อดักจับ Error จังหวะท่อหลุดกะทันหัน
      const { usageData, usageError, lastUpdated } =
        await chrome.storage.local.get([
          "usageData",
          "usageError",
          "lastUpdated",
        ]);

      updateSyncDot(usageError, lastUpdated);

      if (usageError) {
        tabValueEl.textContent = "!";
        tabEl.classList.add("cu-warn");
        bodyEl.hidden = true;
        errorEl.hidden = false;
        updatedEl.textContent = "—";
        return;
      }

      bodyEl.hidden = false;
      errorEl.hidden = true;

      if (!usageData) {
        tabValueEl.textContent = "--";
        tabEl.classList.remove("cu-warn");
        updatedEl.textContent = "กำลังโหลด...";
        return;
      }

      const fiveHour = usageData.five_hour ?? {};
      const sevenDay = usageData.seven_day ?? {};
      const fiveHourPct = Math.max(
        0,
        Math.min(100, Math.round(fiveHour.utilization ?? 0)),
      );

      tabValueEl.textContent = `${fiveHourPct}`;
      tabEl.classList.toggle("cu-warn", fiveHourPct >= 90);

      applyBar(
        barCurrentEl,
        pctCurrentEl,
        barCurrentEl.closest(".cu-metric"),
        fiveHour.utilization,
      );
      applyBar(
        barWeeklyEl,
        pctWeeklyEl,
        barWeeklyEl.closest(".cu-metric"),
        sevenDay.utilization,
      );

      updateCountdown(fiveHour.resets_at, resetCurrentEl, "current");
      updateCountdown(sevenDay.resets_at, resetWeeklyEl, "weekly");

      updatedEl.textContent = lastUpdated
        ? `อัปเดต ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "—";
    } catch (err) {
      // 3. หากมี Error เกิดขึ้นระหว่างรัน ให้เช็กว่าเป็นเพราะ Context หลุดหรือไม่ ถ้าใช่ให้ล้างระบบอย่างนุ่มนวล
      if (err.message && err.message.includes("context invalidated")) {
        console.log(
          "[Claude Extension] Caught context invalidation during render.",
        );
        cleanup();
      } else {
        // หากเป็น Error อื่นๆ ให้พ่นบอกตามปกติ
        console.error(err);
      }
    }
  }

  // อัปเดตทันทีที่ background เขียนข้อมูลใหม่ลง storage (push, ไม่ต้อง poll เอง)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.usageData || changes.usageError || changes.lastUpdated)
      render();
  });

  // เผื่อกรณี background ไม่ได้เขียนค่าใหม่นานผิดปกติ (เช่น alarm ค้าง) ให้จุด sync เปลี่ยนสีตามเวลาจริงด้วย
  setInterval(render, 30 * 1000);

  // ── THEME SYNC ───────────────────────────────────────────────────────────
  // detect light mode จาก claude.ai — ดู class / data attribute บน <html> และ <body>
  function detectTheme() {
    const html = document.documentElement;
    const body = document.body;
    const isLight =
      html.classList.contains("light") ||
      body.classList.contains("light") ||
      html.getAttribute("data-color-scheme") === "light" ||
      body.getAttribute("data-color-scheme") === "light" ||
      html.getAttribute("data-theme") === "light" ||
      body.getAttribute("data-theme") === "light";

    if (isLight) {
      host.classList.add("cu-theme-light");
    } else {
      host.classList.remove("cu-theme-light");
    }
  }

  detectTheme();

  // watch runtime theme changes — user toggles light/dark ใน claude.ai
  const themeObserver = new MutationObserver(detectTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-color-scheme", "data-theme"],
  });
  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-color-scheme", "data-theme"],
  });

  document.documentElement.appendChild(host);
  render();
})();

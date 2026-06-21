const POLL_MINUTES = 1;
const ALARM_NAME = "poll-usage";

const DEFAULT_NOTIFY_THRESHOLD = 95;
const DEFAULT_NOTIFICATIONS_ENABLED = true;

console.log("[Claude Extension] Background script started!");

async function getOrgId() {
  const stored = await chrome.storage.local.get("claudeOrgId");
  if (stored.claudeOrgId) return stored.claudeOrgId;

  const cookie = await chrome.cookies.get({
    url: "https://claude.ai",
    name: "lastActiveOrg",
  });
  if (cookie && cookie.value) {
    await chrome.storage.local.set({ claudeOrgId: cookie.value });
    return cookie.value;
  }
  return null;
}

async function fetchUsage(orgId) {
  const response = await fetch(
    `https://claude.ai/api/organizations/${orgId}/usage`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    },
  );
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  return response.json();
}

function formatBadge(pct) {
  if (pct === null || pct === undefined) return "";
  return `${Math.round(pct)}%`;
}

// สีของ badge อ้างอิงโทนเดียวกับธีม ember / steel / warn ใน popup
function badgeColor(pct) {
  if (pct >= 90) return "#FF5C46"; // วิกฤต — warn
  if (pct >= 50) return "#E2895A"; // กำลังใกล้ — ember
  return "#4FA8A2"; // สบายๆ — steel
}

// ฟังก์ชันส่งการแจ้งเตือนพุชหน้าจอคอมพิวเตอร์
// แจ้งเตือนแค่ "ครั้งเดียวต่อรอบ reset" กันสแปม แทนที่จะดักทุกครั้งที่ % ขยับ
async function checkAndNotify(currentPct, resetsAt) {
  const {
    notifyThreshold = DEFAULT_NOTIFY_THRESHOLD,
    notificationsEnabled = DEFAULT_NOTIFICATIONS_ENABLED,
    lastNotifiedResetAt,
  } = await chrome.storage.local.get([
    "notifyThreshold",
    "notificationsEnabled",
    "lastNotifiedResetAt",
  ]);

  if (!notificationsEnabled) return;
  if (currentPct < notifyThreshold) return;

  // ใช้เวลา reset ของรอบนั้นเป็น key กันแจ้งซ้ำ ถ้า resets_at หาไม่เจอให้ fallback เป็นค่าคงที่
  const windowKey = resetsAt ?? "unknown-window";
  if (lastNotifiedResetAt === windowKey) return; // แจ้งไปแล้วในรอบนี้

  chrome.notifications.create(
    "claude-warning",
    {
      type: "basic",
      // 🛠️ แก้ไข Path ตรงนี้ให้ชี้จาก Root ของ Extension โดยตรง ไม่ใช้ ../
      iconUrl: "assets/icon128.png",
      title: "🚨 โควตา Claude ใกล้เต็มแล้ว!",
      message: `ขณะนี้คุณใช้โควตาไปแล้ว ${Math.round(currentPct)}% เกินเกณฑ์ที่ตั้งไว้ (${notifyThreshold}%) แนะนำให้ระวังการส่งโค้ดชุดใหญ่ครับ`,
      priority: 2,
    },
    (notificationId) => {
      // ดักจับเคส Error หากหาไฟล์ภาพไอคอนไม่เจอจริงๆ เพื่อไม่ให้เบื้องหลังระเบิดพัง
      if (chrome.runtime.lastError) {
        console.warn(
          "[Claude Extension] Notification Icon Error, retrying without custom icon...",
        );
        // ถ้ารูปโหลดไม่ได้ ให้ยิงตัวเปล่าโดยใช้ไอคอนระบบแทน
        chrome.notifications.create("claude-warning-fallback", {
          type: "basic",
          iconUrl:
            "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='128' height='128' fill='%23FF5C46'/></svg>",
          title: "🚨 โควตา Claude ใกล้เต็มแล้ว!",
          message: `ขณะนี้คุณใช้โควตาไปแล้ว ${Math.round(currentPct)}% เกินเกณฑ์ที่ตั้งไว้ (${notifyThreshold}%)`,
          priority: 2,
        });
      }
    },
  );

  await chrome.storage.local.set({ lastNotifiedResetAt: windowKey });
}

async function pollUsage() {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      await chrome.action.setBadgeText({ text: "?" });
      await chrome.action.setBadgeBackgroundColor({ color: "#888888" });
      await chrome.storage.local.set({ usageError: "logged_out" });
      return;
    }

    const data = await fetchUsage(orgId);
    const fiveHourPct = data?.five_hour?.utilization ?? null;
    const fiveHourResetsAt = data?.five_hour?.resets_at ?? null;

    await chrome.storage.local.set({
      usageData: data,
      usageError: null,
      lastUpdated: Date.now(),
    });

    await chrome.action.setBadgeText({ text: formatBadge(fiveHourPct) });
    await chrome.action.setBadgeBackgroundColor({
      color: badgeColor(fiveHourPct ?? 0),
    });

    if (fiveHourPct !== null) {
      await checkAndNotify(fiveHourPct, fiveHourResetsAt);
    }
  } catch (err) {
    await chrome.storage.local.set({ usageError: err.message });
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#FF5C46" });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  pollUsage();
});

chrome.runtime.onStartup.addListener(() => {
  pollUsage();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) pollUsage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "force-poll") {
    pollUsage().then(async () => {
      const { usageError } = await chrome.storage.local.get("usageError");
      sendResponse({ ok: !usageError, error: usageError });
    });
    return true;
  }
});

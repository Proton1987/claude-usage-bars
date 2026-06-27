const POLL_MINUTES = 1;
const ALARM_NAME = "poll-usage";

const DEFAULT_NOTIFY_THRESHOLD = 95;
const DEFAULT_NOTIFICATIONS_ENABLED = true;

console.log("[Claude Extension] Background script started!");

function normalizePct(raw) {
  if (raw === null || raw === undefined) return null;
  return raw <= 1.0 ? raw * 100 : raw;
}

async function getOrgId() {
  const cookie = await chrome.cookies.get({
    url: "https://claude.ai",
    name: "lastActiveOrg",
  });
  const cookieOrgId = cookie?.value ?? null;
  const stored = await chrome.storage.local.get("claudeOrgId");

  if (!cookieOrgId) {
    if (stored.claudeOrgId) {
      await chrome.storage.local.remove("claudeOrgId");
      console.log("[Claude Extension] OrgId cleared — user logged out");
    }
    return null;
  }

  if (stored.claudeOrgId !== cookieOrgId) {
    await chrome.storage.local.set({ claudeOrgId: cookieOrgId });
  }

  return cookieOrgId;
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

function badgeColor(pct) {
  if (pct >= 90) return "#FF5C46";
  if (pct >= 50) return "#E2895A";
  return "#4FA8A2";
}

// แจ้งเตือนครั้งเดียวต่อรอบ reset — ยิงครั้งเดียว ไม่มี fallback ไม่สแปม
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

  const windowKey = resetsAt ?? "unknown-window";
  if (lastNotifiedResetAt === windowKey) return;

  // clear ก่อนกัน duplicate ID silent fail
  await new Promise((r) =>
    chrome.notifications.clear("claude-warning", () => r()),
  );

  await new Promise((resolve) => {
    chrome.notifications.create(
      "claude-warning",
      {
        type: "basic",
        iconUrl: "assets/icon128.png",
        title: "🚨 โควตา Claude ใกล้เต็มแล้ว!",
        message: `ใช้ไปแล้ว ${Math.round(currentPct)}% เกินเกณฑ์ที่ตั้งไว้ (${notifyThreshold}%) แนะนำให้ระวังการส่งโค้ดชุดใหญ่ครับ`,
        priority: 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Claude Extension] Notification failed:",
            chrome.runtime.lastError.message,
          );
          resolve(false);
        } else {
          resolve(true);
        }
      },
    );
  }).then((ok) => {
    if (ok) chrome.storage.local.set({ lastNotifiedResetAt: windowKey });
  });
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

    const normalizedData = {
      ...data,
      five_hour: data?.five_hour
        ? {
            ...data.five_hour,
            utilization: normalizePct(data.five_hour.utilization),
          }
        : undefined,
      seven_day: data?.seven_day
        ? {
            ...data.seven_day,
            utilization: normalizePct(data.seven_day.utilization),
          }
        : undefined,
    };

    const fiveHourPct = normalizedData?.five_hour?.utilization ?? null;
    const fiveHourResetsAt = normalizedData?.five_hour?.resets_at ?? null;

    await chrome.storage.local.set({
      usageData: normalizedData,
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
    console.error("[Claude Extension] pollUsage error:", err);
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

const DEFAULTS = {
  notifyThreshold: 95,
  notificationsEnabled: true,
};

const toggle = document.getElementById("notify-toggle");
const slider = document.getElementById("threshold-slider");
const valueLabel = document.getElementById("threshold-value");
const thresholdCard = document.getElementById("threshold-card");
const saveIndicator = document.getElementById("save-indicator");

let saveTimeout = null;

function showSaved() {
  if (!saveIndicator) return;
  saveIndicator.classList.add("visible");
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(
    () => saveIndicator.classList.remove("visible"),
    1400,
  );
}

function setThresholdCardEnabled(enabled) {
  if (thresholdCard) thresholdCard.classList.toggle("disabled", !enabled);
  if (slider) slider.disabled = !enabled;
}

async function load() {
  const stored = await chrome.storage.local.get([
    "notifyThreshold",
    "notificationsEnabled",
  ]);
  const notifyThreshold = stored.notifyThreshold ?? DEFAULTS.notifyThreshold;
  const notificationsEnabled =
    stored.notificationsEnabled ?? DEFAULTS.notificationsEnabled;

  if (toggle) toggle.checked = notificationsEnabled;
  if (slider) slider.value = notifyThreshold;
  if (valueLabel) valueLabel.textContent = `${notifyThreshold}%`;

  setThresholdCardEnabled(notificationsEnabled);
}

toggle?.addEventListener("change", async () => {
  setThresholdCardEnabled(toggle.checked);
  await chrome.storage.local.set({ notificationsEnabled: toggle.checked });
  showSaved();
});

slider?.addEventListener("input", () => {
  if (valueLabel) valueLabel.textContent = `${slider.value}%`;
});

slider?.addEventListener("change", async () => {
  await chrome.storage.local.set({ notifyThreshold: Number(slider.value) });
  showSaved();
});

document.addEventListener("DOMContentLoaded", load);

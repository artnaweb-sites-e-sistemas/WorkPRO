/**
 * Ponte entre a página do WorkPRO e a extensão (roda só no endereço do WorkPRO).
 * - Guarda o resumo do histórico que o Cold call manda, para marcar as empresas no Google.
 * - Entrega a empresa enviada do Google quando o Cold call avisa que está pronto.
 */

(() => {
  if (window.__workproBridge) return;
  window.__workproBridge = true;

  /** Empresa enviada há mais tempo que isso não é mais entregue. */
  const LEAD_MAX_AGE = 10 * 60 * 1000;

  async function saveIndex(items) {
    if (!Array.isArray(items)) return;
    const { callIndex = {} } = await chrome.storage.local.get("callIndex");
    for (const item of items) {
      if (item && typeof item.id === "string") callIndex[item.id] = item;
    }
    await chrome.storage.local.set({ callIndex, lastSyncAt: Date.now() });
  }

  async function deliverLead() {
    const { pendingLead } = await chrome.storage.local.get("pendingLead");
    if (!pendingLead) return;
    await chrome.storage.local.remove("pendingLead");
    if (Date.now() - (pendingLead.at || 0) > LEAD_MAX_AGE) return;
    window.postMessage({ source: "workpro-extension", type: "lead", lead: pendingLead }, location.origin);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== "workpro-app") return;
    if (data.type === "coldcalls") saveIndex(data.items);
    if (data.type === "ready") deliverLead();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "deliver-lead") {
      deliverLead().then(() => sendResponse({ ok: true }));
      return true;
    }
    return false;
  });
})();

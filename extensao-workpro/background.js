/**
 * Service worker da extensão WorkPRO Cold call.
 * - Injeta a ponte (bridge.js) nas páginas do WorkPRO, no endereço configurado no popup.
 * - Recebe a empresa enviada do Google e leva para o Cold call, abrindo ou reaproveitando a aba.
 */

importScripts("shared.js");

const BRIDGE_ID = "workpro-bridge";

async function getOrigin() {
  const { workproOrigin } = await chrome.storage.local.get({ workproOrigin: WPCC_DEFAULT_ORIGIN });
  return workproOrigin;
}

/** Padrão de URL do Chrome: vale para qualquer porta daquele endereço. */
function matchPatternOf(origin) {
  const url = new URL(origin);
  return `${url.protocol}//${url.hostname}/*`;
}

/** (Re)registra a ponte no endereço atual do WorkPRO. */
async function registerBridge() {
  const origin = await getOrigin();
  const pattern = matchPatternOf(origin);
  const allowed = await chrome.permissions.contains({ origins: [pattern] });
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [BRIDGE_ID] });
  if (existing.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [BRIDGE_ID] });
  }
  if (!allowed) return;
  await chrome.scripting.registerContentScripts([
    {
      id: BRIDGE_ID,
      matches: [pattern],
      js: ["bridge.js"],
      runAt: "document_start"
    }
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  registerBridge().catch((error) => console.error("[WorkPRO] bridge", error));
});

chrome.runtime.onStartup.addListener(() => {
  registerBridge().catch((error) => console.error("[WorkPRO] bridge", error));
});

/** Aba do WorkPRO já aberta: prefere a que está no Cold call. */
async function findWorkproTab(origin) {
  const tabs = await chrome.tabs.query({});
  const mine = tabs.filter((tab) => tab.url && tab.url.startsWith(origin));
  return mine.find((tab) => new URL(tab.url).pathname.startsWith("/ligacao")) || mine[0] || null;
}

async function sendLead(lead) {
  await chrome.storage.local.set({ pendingLead: { ...lead, at: Date.now() } });
  const origin = await getOrigin();
  const target = `${origin}/ligacao`;
  const tab = await findWorkproTab(origin);

  if (!tab) {
    await chrome.tabs.create({ url: target });
    return;
  }

  const onColdCall = new URL(tab.url).pathname.startsWith("/ligacao");
  let delivered = false;
  if (onColdCall) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "deliver-lead" });
      delivered = true;
    } catch {
      // Aba aberta antes da extensão: sem a ponte. Recarrega e ela entrega ao abrir.
    }
  }
  await chrome.tabs.update(tab.id, delivered ? { active: true } : { active: true, url: target });
  await chrome.windows.update(tab.windowId, { focused: true });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "send-lead") {
    sendLead(message.lead)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("[WorkPRO] send-lead", error);
        sendResponse({ ok: false });
      });
    return true;
  }
  if (message?.type === "origin-changed") {
    registerBridge()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "open-coldcall") {
    getOrigin()
      .then(async (origin) => {
        const tab = await findWorkproTab(origin);
        if (tab) {
          await chrome.tabs.update(tab.id, { active: true, url: `${origin}/ligacao` });
          await chrome.windows.update(tab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: `${origin}/ligacao` });
        }
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

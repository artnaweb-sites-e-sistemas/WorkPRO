/**
 * Popup: quantas empresas estão no histórico, legenda das cores e endereço do WorkPRO.
 */

const countEl = document.getElementById("count");
const countLabelEl = document.getElementById("countLabel");
const syncEl = document.getElementById("sync");
const originInput = document.getElementById("origin");
const originNote = document.getElementById("originNote");
const saveButton = document.getElementById("save");
const openButton = document.getElementById("open");

function ago(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `em ${new Date(ms).toLocaleDateString("pt-BR")}`;
}

async function load() {
  const { callIndex = {}, lastSyncAt, workproOrigin = WPCC_DEFAULT_ORIGIN } = await chrome.storage.local.get([
    "callIndex",
    "lastSyncAt",
    "workproOrigin"
  ]);
  const total = new Set(Object.values(callIndex).map((item) => item.companyKey || item.id)).size;
  countEl.textContent = String(total);
  countLabelEl.textContent = total === 1 ? "empresa com ligação" : "empresas com ligação";
  if (lastSyncAt) syncEl.textContent = `Sincronizado ${ago(lastSyncAt)}, pelo Cold call aberto.`;
  originInput.value = workproOrigin;
}

function setNote(text, isError = false) {
  originNote.textContent = text;
  originNote.classList.toggle("error", isError);
}

saveButton.addEventListener("click", async () => {
  let origin;
  try {
    origin = new URL(originInput.value.trim()).origin;
  } catch {
    setNote("Endereço inválido. Ex.: https://workpro.seudominio.com.br", true);
    return;
  }
  saveButton.disabled = true;
  try {
    const url = new URL(origin);
    const pattern = `${url.protocol}//${url.hostname}/*`;
    // Precisa vir do clique: o Chrome só pede permissão em resposta a um gesto.
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) {
      setNote("Sem a permissão, a extensão não consegue falar com o WorkPRO.", true);
      return;
    }
    await chrome.storage.local.set({ workproOrigin: origin });
    await chrome.runtime.sendMessage({ type: "origin-changed" });
    originInput.value = origin;
    setNote("Salvo. Recarregue a aba do WorkPRO para conectar.");
  } catch (error) {
    console.error(error);
    setNote("Não deu para salvar. Tente de novo.", true);
  } finally {
    saveButton.disabled = false;
  }
});

openButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "open-coldcall" });
  window.close();
});

load();

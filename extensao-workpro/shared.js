/**
 * Regras compartilhadas entre as páginas do Google e o popup.
 * A comparação de empresa e telefone é a mesma do WorkPRO (src/types/coldCall.ts).
 */

/* eslint-disable no-unused-vars */

const WPCC_DEFAULT_ORIGIN = "http://localhost:5173";

/** "Estúdio Carla Carrion" e "estudio  carla carrion" são a mesma empresa. */
function wpccCompanyKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Últimos 8 dígitos: pega o mesmo número com ou sem DDD, com ou sem máscara. */
function wpccPhoneKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

/**
 * Status mostrados no Google. Azul: tentar de novo (não atendeu ou pediu retorno).
 * Verde: reunião marcada. Vermelho: não quis. Cinza: ligação que ficou pela metade.
 */
const WPCC_STATUS = {
  "nao-atendeu": { label: "Não atendeu", color: "#3B82F6" },
  retorno: { label: "Ligar de novo", color: "#3B82F6" },
  agendou: { label: "Reunião marcada", color: "#22C55E" },
  "sem-interesse": { label: "Não quis", color: "#EF4444" },
  andamento: { label: "Em andamento", color: "#A1A1AA" }
};

function wpccStatusOf(item) {
  return WPCC_STATUS[item.outcome] || WPCC_STATUS.andamento;
}

function wpccDay(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "hoje";
  if (date.toDateString() === yesterday.toDateString()) return "ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "Não atendeu · 2ª tentativa · ontem" */
function wpccStatusText(item) {
  const parts = [wpccStatusOf(item).label];
  if (item.attempts > 1) parts.push(`${item.attempts}ª tentativa`);
  const day = wpccDay(item.lastMs);
  if (day) parts.push(day);
  return parts.join(" · ");
}

/** Identificador do lugar no Google Maps (vem no link do card e na URL do painel). */
function wpccPlaceId(url) {
  const match = String(url || "").match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Acha a ligação: pelo lugar do Google (o mais preciso), pelo telefone ou pelo nome normalizado.
 * O card da lista quase nunca mostra telefone; por isso o lugar vem primeiro.
 */
function wpccFindCall(index, name, phone, placeId) {
  const items = Object.values(index || {});
  if (placeId) {
    const byPlace = items.find((item) => item.placeId === placeId);
    if (byPlace) return byPlace;
  }
  const phoneKey = wpccPhoneKey(phone);
  if (phoneKey) {
    const byPhone = items.find((item) => item.phoneKey === phoneKey);
    if (byPhone) return byPhone;
  }
  const companyKey = wpccCompanyKey(name);
  if (!companyKey) return null;
  return items.find((item) => item.companyKey === companyKey) || null;
}

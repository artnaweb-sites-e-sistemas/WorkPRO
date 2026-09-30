/**
 * Roda no Google Maps e na busca do Google (aba Locais e painel da empresa).
 * - Painel da empresa: barra com o status da última ligação e o botão para mandar ao Cold call.
 * - Listas: marca com a cor do status as empresas que já receberam ligação.
 *
 * O Google muda as classes de vez em quando. Os seletores do Maps foram conferidos em 30/09/2026;
 * os da busca usam atributos de dados (data-attrid) e texto, que mudam menos.
 */

(() => {
  if (window.__workproColdCall) return;
  window.__workproColdCall = true;

  const IS_MAPS = location.pathname.startsWith("/maps");
  const PHONE_RE = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/;

  let index = {};
  let timer = null;

  chrome.storage.local.get("callIndex").then((result) => {
    index = result.callIndex || {};
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.callIndex) {
      index = changes.callIndex.newValue || {};
      schedule();
    }
  });

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  }

  new MutationObserver((mutations) => {
    // Ignora o que a própria extensão desenhou, para não entrar em laço.
    const external = mutations.some((mutation) => !mutation.target.closest?.(".wpcc-bar, .wpcc-tag"));
    if (external) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  function render() {
    try {
      if (IS_MAPS) {
        renderMapsPlace();
        renderMapsList();
      } else {
        renderSearchPanel();
        renderSearchList();
      }
    } catch (error) {
      console.error("[WorkPRO Cold call]", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Leitura dos dados
  // ---------------------------------------------------------------------------

  function clean(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function phoneFromText(text) {
    const match = clean(text).match(PHONE_RE);
    return match ? match[0].trim() : "";
  }

  /** "R. Alípio de Góes, 96 - Cocaia, Ilhabela - SP, 11630-000" → "Ilhabela" */
  function cityFromAddress(address) {
    const text = clean(address).replace(/^[^:]*:\s*/, "");
    const matches = [...text.matchAll(/(?:^|,)\s*([^,]+?)\s+-\s+[A-Z]{2}\b/g)];
    return matches.length ? clean(matches[matches.length - 1][1]) : "";
  }

  // ---------------------------------------------------------------------------
  // Barra do painel da empresa
  // ---------------------------------------------------------------------------

  /**
   * `place.inside`: a barra entra no fim desse bloco (Maps: o cabeçalho do painel é um bloco em coluna).
   * `place.after`: a barra entra logo depois desse elemento (busca: depois do título).
   */
  function mountBar(place, lead) {
    const host = place.inside || (place.after && place.after.parentElement);
    if (!host || !lead.empresa) return;
    let bar = place.inside
      ? place.inside.querySelector(":scope > .wpcc-bar")
      : place.after.nextElementSibling;
    if (!bar || !bar.classList.contains("wpcc-bar")) {
      bar = document.createElement("div");
      bar.className = "wpcc-bar";
      if (place.inside) place.inside.append(bar);
      else place.after.insertAdjacentElement("afterend", bar);
    }

    const match = wpccFindCall(index, lead.empresa, lead.telefone);
    const signature = JSON.stringify([lead, match && [match.id, match.outcome, match.attempts, match.lastMs]]);
    if (bar.dataset.sig === signature) return;
    bar.dataset.sig = signature;
    bar.textContent = "";

    if (match) {
      const status = wpccStatusOf(match);
      const chip = document.createElement("span");
      chip.className = "wpcc-chip";
      chip.style.setProperty("--wpcc", status.color);
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      chip.append(dot, wpccStatusText(match));
      if (match.responsavel) chip.title = `Falou com ${match.responsavel}`;
      bar.append(chip);
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = match ? "wpcc-button wpcc-button--quiet" : "wpcc-button";
    const label = match ? "Abrir no Cold call" : "Enviar para o Cold call";
    button.textContent = label;
    button.addEventListener("click", () => send(button, label, lead));
    bar.append(button);

    if (!match) {
      const hint = document.createElement("span");
      hint.className = "wpcc-hint";
      hint.textContent = lead.telefone ? "Ainda não ligou" : "Ainda não ligou · sem telefone no Google";
      bar.append(hint);
    }
  }

  function send(button, label, lead) {
    button.disabled = true;
    button.textContent = "Abrindo o Cold call…";
    try {
      chrome.runtime.sendMessage({ type: "send-lead", lead }, (response) => {
        button.textContent = response && response.ok ? "Enviado" : "Não deu. Tente de novo";
        setTimeout(() => {
          button.disabled = false;
          button.textContent = label;
        }, 1800);
      });
    } catch {
      // Extensão atualizada com a página aberta: o contexto antigo não fala mais com ela.
      button.textContent = "Recarregue a página";
    }
  }

  // ---------------------------------------------------------------------------
  // Marca nas listas
  // ---------------------------------------------------------------------------

  function markItem(card, nameEl, match) {
    if (!card || !nameEl) return;
    const signature = match ? JSON.stringify([match.id, match.outcome, match.attempts, match.lastMs]) : "";
    if ((card.dataset.wpccSig || "") === signature) return;
    card.dataset.wpccSig = signature;

    const old = nameEl.parentElement && nameEl.parentElement.querySelector(":scope > .wpcc-tag");
    if (old) old.remove();

    if (!match) {
      card.classList.remove("wpcc-marked");
      card.style.removeProperty("--wpcc");
      return;
    }
    const status = wpccStatusOf(match);
    card.classList.add("wpcc-marked");
    card.style.setProperty("--wpcc", status.color);

    const tag = document.createElement("span");
    tag.className = "wpcc-tag";
    tag.style.setProperty("--wpcc", status.color);
    tag.textContent = status.label;
    tag.title = wpccStatusText(match);
    nameEl.insertAdjacentElement("afterend", tag);
  }

  // ---------------------------------------------------------------------------
  // Google Maps
  // ---------------------------------------------------------------------------

  function renderMapsPlace() {
    const title = document.querySelector("h1.DUwDvf");
    if (!title) return;
    const phoneButton = document.querySelector('button[data-item-id^="phone:tel:"]');
    const phone = phoneButton
      ? phoneFromText(phoneButton.getAttribute("aria-label")) || phoneButton.dataset.itemId.replace("phone:tel:", "")
      : "";
    const address = document.querySelector('button[data-item-id="address"]');
    const category = document.querySelector('button[jsaction*="category"]');
    // .lMbq3e é o cabeçalho do painel (nome, nota, categoria); o pai dele é uma linha flex.
    const header = title.closest(".lMbq3e");
    mountBar(header ? { inside: header } : { after: title.parentElement }, {
      empresa: clean(title.textContent),
      telefone: phone,
      cidade: cityFromAddress(address ? address.getAttribute("aria-label") : ""),
      categoria: clean(category ? category.textContent : "")
    });
  }

  function renderMapsList() {
    for (const card of document.querySelectorAll('div[role="feed"] div[role="article"]')) {
      const link = card.querySelector("a.hfpxzc");
      const nameEl = card.querySelector(".qBF1Pd");
      const name = (link && link.getAttribute("aria-label")) || (nameEl && nameEl.textContent);
      const phoneEl = card.querySelector(".UsdlK");
      markItem(card, nameEl, wpccFindCall(index, name, phoneEl ? phoneEl.textContent : ""));
    }
  }

  // ---------------------------------------------------------------------------
  // Busca do Google (aba Locais e painel lateral da empresa)
  // ---------------------------------------------------------------------------

  function renderSearchPanel() {
    const title = document.querySelector('[data-attrid="title"]');
    if (!title) return;
    const panel =
      title.closest('#rhs, [role="complementary"], .kp-wholepage, [data-hveid][jscontroller]') || document.body;
    const phoneEl = panel.querySelector(
      '[data-local-attribute="d3ph"], [data-dtype="d3ph"], [data-attrid*="phone"], a[href^="tel:"], [aria-label^="Ligar para"]'
    );
    const addressEl = panel.querySelector(
      '[data-local-attribute="d3adr"], [data-attrid="kc:/location/location:address"], [data-attrid*="address"]'
    );
    const subtitle = panel.querySelector('[data-attrid="subtitle"]');
    mountBar({ after: title }, {
      empresa: clean(title.textContent),
      telefone: phoneEl ? phoneFromText(phoneEl.getAttribute("aria-label") || phoneEl.textContent) : "",
      cidade: cityFromAddress(addressEl ? addressEl.textContent : ""),
      categoria: clean(subtitle ? subtitle.textContent : "").split("·").pop().trim()
    });
  }

  function renderSearchList() {
    const seen = new Set();
    const headings = document.querySelectorAll(
      '.dbg0pd, .rllt__details [role="heading"], [data-cid] [role="heading"], .VkpGBb [role="heading"]'
    );
    for (const heading of headings) {
      if (seen.has(heading) || heading.closest(".wpcc-bar")) continue;
      seen.add(heading);
      const card = heading.closest("[data-cid], .VkpGBb, .rllt__details") || heading.parentElement;
      const cardText = card && card.innerText && card.innerText.length < 800 ? card.innerText : "";
      markItem(card, heading, wpccFindCall(index, heading.textContent, phoneFromText(cardText)));
    }
  }
})();

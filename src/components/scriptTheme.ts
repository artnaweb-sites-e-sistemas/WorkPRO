/**
 * Tema dos roteiros (reunião e ligação fria): fundo escuro e as cores das anotações.
 * Escopado em `.rt`, para não vazar para o resto do app.
 */

/* Cores das anotações: cada resposta do lead tem uma, e reaparece nela nas fichas seguintes. */
export const SCRIPT_THEME_CSS = `
.rt { --rt-paper:#18181B; --rt-rule:#27272A; --rt-muted:#A1A1AA; --rt-faint:#71717A; --rt-ink:#FAFAFA; --rt-silence:#FF8A7A;
  --c1-bg:#1b2a52; --c1-fg:#b7cbff; --c2-bg:#2a2e36; --c2-fg:#d0d5de; --c3-bg:#4a1f1a; --c3-fg:#ffc2b8;
  --c4-bg:#173a2c; --c4-fg:#a6e8c9; --c5-bg:#45300f; --c5-fg:#ffd199; --c6-bg:#2c2350; --c6-fg:#d2c4ff;
  --c7-bg:#47192f; --c7-fg:#ffbddb; --c8-bg:#173640; --c8-fg:#a9e3f2; --c9-bg:#3e3510; --c9-fg:#ffe486;
  --c10-bg:#2f3a12; --c10-fg:#d4f08a; }
.rt .pill { border-radius:4px; padding:0 5px; font-weight:600; -webkit-box-decoration-break:clone; box-decoration-break:clone; }
.rt .pill.empty { font-weight:400; font-style:italic; opacity:.8; }
.rt .c1{background:var(--c1-bg);color:var(--c1-fg)} .rt .c2{background:var(--c2-bg);color:var(--c2-fg)}
.rt .c3{background:var(--c3-bg);color:var(--c3-fg)} .rt .c4{background:var(--c4-bg);color:var(--c4-fg)}
.rt .c5{background:var(--c5-bg);color:var(--c5-fg)} .rt .c6{background:var(--c6-bg);color:var(--c6-fg)}
.rt .c7{background:var(--c7-bg);color:var(--c7-fg)} .rt .c8{background:var(--c8-bg);color:var(--c8-fg)}
.rt .c9{background:var(--c9-bg);color:var(--c9-fg)} .rt .c10{background:var(--c10-bg);color:var(--c10-fg)}
`

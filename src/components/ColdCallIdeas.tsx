import { useState } from 'react'
import type { FormEvent } from 'react'
import { SCORE_LABELS, chanceTier, suggestProspecting } from '../ai/suggestProspecting'
import type { ProspectResult, ProspectScores, ProspectStage, ProspectSuggestion } from '../ai/suggestProspecting'

const STORAGE_KEY = 'workpro.coldcall.ideas.v2'

interface SavedIdeas {
  nicho: string
  regiao: string
  result: ProspectResult
  at: number
}

function loadSaved(): SavedIdeas | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? (JSON.parse(raw) as SavedIdeas) : null
    return data && Array.isArray(data.result?.sugestoes) ? data : null
  } catch {
    return null
  }
}

function save(data: SavedIdeas) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // sem armazenamento: só não lembra na próxima vez
  }
}

function whatHappens(nicho: string, regiao: string): string {
  if (nicho && regiao) return `A IA pesquisa ${regiao} no Google e avalia ${nicho} e os nichos vizinhos que valem mais ali. Leva uns 30 segundos.`
  if (regiao) return `A IA pesquisa ${regiao} no Google e ranqueia os nichos onde é mais fácil falar com o dono. Leva uns 30 segundos.`
  return `A IA sugere as cidades com mais chance para ${nicho}.`
}

/** Aba Locais do Google, já com a busca. */
function localsUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=lcl`
}

function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const TIER: Record<'alta' | 'boa' | 'media', { label: string; color: string }> = {
  alta: { label: 'Chance alta', color: 'var(--c4-fg)' },
  boa: { label: 'Boa chance', color: 'var(--rt-ink)' },
  media: { label: 'Chance média', color: 'var(--rt-faint)' },
}

function scoreSummary(notas: ProspectScores): string {
  return (Object.keys(SCORE_LABELS) as (keyof ProspectScores)[]).map((key) => `${SCORE_LABELS[key]}: ${notas[key]}/5`).join('\n')
}

const fieldClass =
  'w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'

/** Aba "Onde prospectar": a IA pesquisa a região e ranqueia os nichos com mais chance de falar com o dono. */
export function ColdCallIdeas({ onUse }: { onUse: (suggestion: ProspectSuggestion) => void }) {
  const [saved] = useState(loadSaved)
  const [regiao, setRegiao] = useState(saved?.regiao ?? '')
  const [nicho, setNicho] = useState(saved?.nicho ?? '')
  const [result, setResult] = useState<ProspectResult | null>(saved?.result ?? null)
  /** o pedido que gerou o resultado na tela */
  const [asked, setAsked] = useState({ nicho: saved?.nicho ?? '', regiao: saved?.regiao ?? '' })
  const [at, setAt] = useState<number | null>(saved?.at ?? null)
  const [stage, setStage] = useState<ProspectStage | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [showAvoid, setShowAvoid] = useState(false)

  const typedNicho = nicho.trim()
  const typedRegiao = regiao.trim()
  const missing = !typedNicho && !typedRegiao
  const loading = stage !== null

  async function run(event: FormEvent) {
    event.preventDefault()
    if (missing || loading) return
    setError('')
    setStage(typedRegiao ? 'pesquisando' : 'comparando')
    try {
      const next = await suggestProspecting({ nicho: typedNicho, regiao: typedRegiao, onStage: setStage })
      const now = Date.now()
      setResult(next)
      setAsked({ nicho: typedNicho, regiao: typedRegiao })
      setAt(now)
      setOpen(0)
      setShowAvoid(false)
      save({ nicho: typedNicho, regiao: typedRegiao, result: next, at: now })
    } catch (err) {
      console.error('[ColdCallIdeas]', err)
      setError('Não deu para pesquisar agora. Tente de novo em alguns segundos.')
    } finally {
      setStage(null)
    }
  }

  const helper = error
    ? error
    : stage === 'pesquisando'
      ? `Pesquisando ${typedRegiao} no Google…`
      : stage === 'comparando'
        ? 'Comparando os nichos e montando a lista…'
        : missing
          ? 'Diga a cidade ou região, o nicho, ou os dois.'
          : whatHappens(typedNicho, typedRegiao)

  const askedRegiao = plain(asked.regiao)
  const title = asked.regiao
    ? `Nichos para ${asked.regiao}${asked.nicho ? `, a partir de ${asked.nicho}` : ''}`
    : `Cidades para ${asked.nicho}`

  return (
    <div className="mx-auto mt-8 max-w-6xl px-6">
      <div className="max-w-4xl">
        <h1 className="text-[26px] font-bold leading-tight text-foreground">Onde prospectar</h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
          A IA pesquisa a região e ranqueia os nichos onde é mais fácil falar com o dono e fechar o Piloto 45.
        </p>

        <form onSubmit={(event) => void run(event)} className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">Cidade ou região</span>
            <input value={regiao} onChange={(event) => setRegiao(event.target.value)} placeholder="Cidade, bairro ou estado" className={fieldClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">
              Nicho <span className="font-normal" style={{ color: 'var(--rt-faint)' }}>(opcional)</span>
            </span>
            <input value={nicho} onChange={(event) => setNicho(event.target.value)} placeholder="Vazio: a IA escolhe" className={fieldClass} />
          </label>
          <button
            type="submit"
            disabled={missing || loading}
            aria-busy={loading}
            className="h-[46px] whitespace-nowrap rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors disabled:opacity-50"
          >
            {loading ? 'Pesquisando…' : result ? 'Pesquisar de novo' : 'Pesquisar nichos'}
          </button>
        </form>
        <p className={`mt-2 text-sm${error ? ' text-status-error' : ''}`} style={error ? undefined : { color: 'var(--rt-muted)' }} role="status">
          {helper}
        </p>

        {result ? (
          <section className="mt-10" aria-busy={loading}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 className="text-[17px] font-semibold text-foreground">{title}</h2>
              {at ? (
                <span className="whitespace-nowrap text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                  {result.pesquisou ? 'Com pesquisa no Google · ' : ''}
                  {new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </div>
            {result.leitura ? (
              <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed" style={{ color: 'var(--rt-muted)' }}>
                {result.leitura}
              </p>
            ) : null}

            <ol className="mt-5 border-t" style={{ borderColor: 'var(--rt-rule)' }}>
              {result.sugestoes.map((item, index) => {
                const expanded = open === index
                const tier = TIER[chanceTier(item.chance)]
                // Mesma cidade do pedido: não repete em toda linha.
                const showRegion = !askedRegiao || !plain(item.regiao).includes(askedRegiao.split(/\s*[-,]\s*/)[0])
                const cidade = item.regiao.replace(/\s*[-–,]\s*[A-Z]{2}$/, '').trim()
                return (
                  <li key={`${item.nicho}-${item.regiao}`} className="border-b" style={{ borderColor: 'var(--rt-rule)' }}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : index)}
                      className="group grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-4 py-4 text-left"
                    >
                      <span className="pt-0.5 text-sm tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-semibold text-foreground transition-colors group-hover:text-accent">
                          {capitalize(item.nicho)}
                          {showRegion ? (
                            <span className="font-normal" style={{ color: 'var(--rt-muted)' }}>
                              {' '}
                              · {item.regiao}
                            </span>
                          ) : null}
                        </span>
                        <span className={`mt-0.5 block text-sm leading-snug${expanded ? '' : ' truncate'}`} style={{ color: 'var(--rt-muted)' }}>
                          {item.porque}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 pt-0.5 text-sm">
                        <span className="whitespace-nowrap" style={{ color: tier.color }} title={scoreSummary(item.notas)}>
                          {tier.label}
                        </span>
                        <span aria-hidden className="w-3 text-center" style={{ color: 'var(--rt-faint)' }}>
                          {expanded ? '−' : '+'}
                        </span>
                      </span>
                    </button>

                    {expanded ? (
                      <div className="grid gap-5 pb-6 pl-[2.75rem]">
                        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                              Quem atende
                            </dt>
                            <dd className="mt-0.5 text-foreground">{item.quemAtende}</dd>
                          </div>
                          <div>
                            <dt className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                              Melhor horário
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-foreground">{item.melhorHorario}</dd>
                          </div>
                          <div>
                            <dt className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                              Ticket típico
                            </dt>
                            <dd className="mt-0.5 tabular-nums text-foreground">{item.ticket}</dd>
                          </div>
                        </dl>

                        <div>
                          <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                            Quem escolher na lista do Google
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-foreground">{item.sinais}</p>
                        </div>

                        <div>
                          <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                            Buscas prontas no Google Locais
                          </p>
                          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5">
                            {item.buscas.map((busca) => (
                              <li key={busca}>
                                <a
                                  href={localsUrl(busca)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-accent"
                                  style={{ color: 'var(--c1-fg)' }}
                                >
                                  {busca} ↗
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            type="button"
                            onClick={() => onUse(item)}
                            className="whitespace-nowrap rounded-md border border-border px-3.5 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
                          >
                            Usar no Cold call
                          </button>
                          <span className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                            A próxima ligação começa com {item.nicho} em {cidade}.
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ol>

            {result.evitar.length ? (
              <div className="mt-6">
                <button
                  type="button"
                  aria-expanded={showAvoid}
                  onClick={() => setShowAvoid((value) => !value)}
                  className="group flex items-center gap-2 text-sm"
                >
                  <span className="font-semibold text-foreground transition-colors group-hover:text-accent">Evite agora</span>
                  <span className="c2 rounded px-1.5 text-xs tabular-nums">{result.evitar.length}</span>
                  <span aria-hidden style={{ color: 'var(--rt-faint)' }}>
                    {showAvoid ? '−' : '+'}
                  </span>
                </button>
                {showAvoid ? (
                  <ul className="mt-2">
                    {result.evitar.map((item) => (
                      <li key={item.nicho} className="border-t py-2.5 text-sm first:border-t-0" style={{ borderColor: 'var(--rt-rule)' }}>
                        <span className="font-semibold text-foreground">{capitalize(item.nicho)}</span>
                        <span style={{ color: 'var(--rt-muted)' }}> · {item.motivo}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <p className="mt-8 text-xs" style={{ color: 'var(--rt-faint)' }}>
              Ordem pela chance de falar com o dono e fechar: acesso ao dono pesa mais, depois o valor do cliente e a procura no Google.
              Passe o mouse na chance para ver as notas.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

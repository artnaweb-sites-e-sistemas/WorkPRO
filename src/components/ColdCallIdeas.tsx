import { useEffect, useState } from 'react'
import { suggestProspecting } from '../ai/suggestProspecting'
import type { ProspectResult, ProspectSuggestion } from '../ai/suggestProspecting'
import type { ColdCall } from '../types/coldCall'
import { reachedOwner } from '../types/coldCall'

const STORAGE_KEY = 'workpro.coldcall.ideas'

interface SavedIdeas {
  nicho: string
  regiao: string
  result: ProspectResult
  at: number
}

function loadSaved(): SavedIdeas | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedIdeas) : null
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

/** Resumo do histórico por nicho + cidade, para a IA saber o que já foi feito e o que deu certo. */
function summarize(calls: ColdCall[]): string[] {
  const groups = new Map<
    string,
    { nicho: string; cidade: string; total: number; atenderam: number; dono: number; reunioes: number; recusas: number; ultima: number }
  >()
  for (const call of calls) {
    const nicho = (call.notes.nicho ?? '').trim()
    const cidade = (call.notes.cidade ?? '').trim()
    const key = `${nicho.toLowerCase()}|${cidade.toLowerCase()}`
    const group = groups.get(key) ?? { nicho, cidade, total: 0, atenderam: 0, dono: 0, reunioes: 0, recusas: 0, ultima: 0 }
    group.total += 1
    if ([...call.path, call.nodeId].includes('quem')) group.atenderam += 1
    if (reachedOwner(call)) group.dono += 1
    if (call.outcome === 'agendou') group.reunioes += 1
    if (call.outcome === 'sem-interesse') group.recusas += 1
    group.ultima = Math.max(group.ultima, call.startedAtMs)
    groups.set(key, group)
  }
  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 40)
    .map(
      (g) =>
        `${g.nicho || 'sem nicho'} | ${g.cidade || 'sem cidade'}: ${g.total} ligações, ${g.atenderam} atenderam, ` +
        `${g.dono} com o dono, ${g.reunioes} reuniões, ${g.recusas} recusaram, última em ${new Date(g.ultima).toLocaleDateString('pt-BR')}`,
    )
}

function whatHappens(nicho: string, regiao: string): string {
  if (nicho && regiao) return `A IA sugere recortes e buscas para ${nicho} em ${regiao} e arredores, olhando o que você já ligou.`
  if (nicho) return `A IA sugere as cidades com mais chance para ${nicho}, priorizando onde você ainda não ligou.`
  if (regiao) return `A IA sugere os nichos com mais chance em ${regiao}: bolso para o plano e dono fácil de alcançar.`
  return 'Sem nicho nem região: a IA cruza seu histórico e sugere as melhores combinações para abordar agora.'
}

function localsUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=local`
}

const fieldClass =
  'w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'

/** Aba "Onde prospectar": a IA sugere nichos, cidades e as buscas para o Google Locais. */
export function ColdCallIdeas({
  calls,
  onUse,
}: {
  calls: ColdCall[]
  onUse: (suggestion: ProspectSuggestion) => void
}) {
  const [saved] = useState(loadSaved)
  const [nicho, setNicho] = useState(saved?.nicho ?? '')
  const [regiao, setRegiao] = useState(saved?.regiao ?? '')
  const [result, setResult] = useState<ProspectResult | null>(saved?.result ?? null)
  const [at, setAt] = useState<number | null>(saved?.at ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
  }, [nicho, regiao])

  async function run() {
    setLoading(true)
    setError('')
    try {
      const next = await suggestProspecting({ nicho: nicho.trim(), regiao: regiao.trim(), historico: summarize(calls) })
      const now = Date.now()
      setResult(next)
      setAt(now)
      save({ nicho: nicho.trim(), regiao: regiao.trim(), result: next, at: now })
    } catch (err) {
      console.error('[ColdCallIdeas]', err)
      setError('Não deu para gerar agora. Tente de novo em alguns segundos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl px-6">
      <div className="max-w-3xl">
        <h1 className="text-[26px] font-bold leading-tight text-foreground">Onde prospectar</h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
          Preencha um nicho, uma região, os dois ou nenhum. A IA olha suas ligações e devolve as buscas prontas para o Google Locais.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">Nicho</span>
            <input
              value={nicho}
              onChange={(event) => setNicho(event.target.value)}
              placeholder="Ex.: clínicas de estética"
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-foreground">Região</span>
            <input
              value={regiao}
              onChange={(event) => setRegiao(event.target.value)}
              placeholder="Ex.: interior de SP, Campinas"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            aria-busy={loading}
            className="whitespace-nowrap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors disabled:opacity-60"
          >
            {loading ? 'Pensando…' : result ? 'Sugerir de novo' : 'Sugerir onde ligar'}
          </button>
          <p className="min-w-0 flex-1 text-sm" style={{ color: error ? undefined : 'var(--rt-muted)' }}>
            {error ? <span className="text-status-error">{error}</span> : whatHappens(nicho.trim(), regiao.trim())}
          </p>
        </div>
      </div>

      {result ? (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--rt-rule)' }}>
            <p className="max-w-3xl text-[16px] leading-relaxed text-foreground">{result.leitura}</p>
            {at ? (
              <span className="whitespace-nowrap text-xs tabular-nums" style={{ color: 'var(--rt-faint)' }}>
                Gerado em {new Date(at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>

          <ol>
            {result.sugestoes.map((item, itemIndex) => (
              <li
                key={`${item.nicho}-${item.regiao}-${itemIndex}`}
                className="grid gap-4 border-b py-5 md:grid-cols-[minmax(0,1fr)_auto]"
                style={{ borderColor: 'var(--rt-rule)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: item.prioridade === 'alta' ? 'var(--c4-fg)' : 'var(--rt-faint)' }}>
                    {item.prioridade === 'alta' ? '● Mais chance' : '● Boa chance'}
                  </p>
                  <h2 className="mt-1 text-[18px] font-bold text-foreground">
                    {item.nicho} <span className="font-medium" style={{ color: 'var(--rt-muted)' }}>· {item.regiao}</span>
                  </h2>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground">{item.porque}</p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--rt-muted)' }}>
                    <strong className="font-semibold text-foreground">Ao ligar:</strong> {item.abordagem}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {item.buscas.map((busca) => (
                      <a
                        key={busca}
                        href={localsUrl(busca)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline decoration-[color:var(--rt-rule)] underline-offset-4 transition-colors hover:text-accent"
                        style={{ color: 'var(--c1-fg)' }}
                      >
                        {busca} ↗
                      </a>
                    ))}
                  </div>
                </div>
                <div className="md:pt-5">
                  <button
                    type="button"
                    onClick={() => onUse(item)}
                    className="whitespace-nowrap rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
                  >
                    Usar no Cold call
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs" style={{ color: 'var(--rt-faint)' }}>
            Sugestões da IA com base nos critérios da oferta e no seu histórico. Cada busca abre a aba Locais do Google.
          </p>
        </section>
      ) : null}
    </div>
  )
}

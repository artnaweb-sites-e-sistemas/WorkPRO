import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { brl } from '../components/piloto/deck'
import {
  AD_BUDGET_PER_CHANNEL_CENTS,
  AGENCY_DEAL_CENTS,
  AGENCY_LIST_CENTS,
  INSTALLMENT_COUNT,
  calcInstallments,
} from '../lib/pilotoPricing'
import {
  SCRIPT_CAPTURES,
  SCRIPT_OBJECTIONS,
  SCRIPT_PARTS,
  buildScriptCards,
  parseKeyQuestion,
} from '../lib/pilotoScript'
import type { ScriptAdapt, ScriptCard } from '../lib/pilotoScript'
import { personalizeScriptLine } from '../ai/personalizeScriptLine'
import { polishScriptNote } from '../ai/polishScriptNote'
import { getPiloto, updatePilotoScript } from '../services/pilotos'
import type { PilotoScript } from '../types/piloto'
import { EMPTY_PILOTO_SCRIPT } from '../types/piloto'

const SAVE_DELAY = 800
/** Suba quando mudar a instrução da IA em personalizeScriptLine: força gerar as falas de novo. */
const ADAPT_VERSION = 3

/* Cores das anotações: cada resposta do lead tem uma, e reaparece nela nas fichas seguintes. */
const STYLES = `
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

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/** Troca {chave} pela anotação colorida e [pista] por texto apagado. */
function renderFilled(text: string, notes: Record<string, string>): ReactNode[] {
  return text.split(/(\{\w+\}|\[[^\]]+\])/g).map((piece, index) => {
    const key = piece.match(/^\{(\w+)\}$/)?.[1]
    if (key) {
      const capture = SCRIPT_CAPTURES[key]
      if (!capture) {
        return null
      }
      const value = (notes[key] ?? '').trim()
      if (!capture.color) {
        return value ? (
          <strong key={index} className="font-semibold text-foreground">
            {value}
          </strong>
        ) : (
          <span key={index} className="pill empty c2">
            {capture.label.toLowerCase()}
          </span>
        )
      }
      return (
        <span key={index} className={`pill ${capture.color}${value ? '' : ' empty'}`}>
          {value || capture.label.toLowerCase()}
        </span>
      )
    }
    if (/^\[[^\]]+\]$/.test(piece)) {
      return (
        <span key={index} style={{ color: 'var(--rt-faint)' }}>
          {piece}
        </span>
      )
    }
    return piece
  })
}

function Line({ text, notes }: { text: string; notes: Record<string, string> }) {
  const [main, tip] = text.split('#')
  return (
    <>
      <span>{renderFilled(main, notes)}</span>
      {tip ? (
        <span className="mt-1 block text-sm" style={{ color: 'var(--rt-muted)' }}>
          {tip}
        </span>
      ) : null}
    </>
  )
}

/** Selo da pergunta-chave: na cor do campo onde a resposta vai. */
function KeyTag({ captureKey }: { captureKey: string }) {
  const capture = SCRIPT_CAPTURES[captureKey]
  if (!capture) return null
  return (
    <span className={`pill ${capture.color ?? 'c2'} mt-1.5 inline-block text-xs`}>Espere e anote: {capture.label.toLowerCase()}</span>
  )
}

const keyBorder = (captureKey: string | null) =>
  captureKey && SCRIPT_CAPTURES[captureKey]?.color ? `var(--${SCRIPT_CAPTURES[captureKey].color}-fg)` : 'var(--rt-rule)'

type RenderLine = (card: ScriptCard, target: number | 'fale', text: string) => ReactNode

function Card({
  card,
  index,
  total,
  notes,
  renderLine,
}: {
  card: ScriptCard
  index: number
  total: number
  notes: Record<string, string>
  renderLine: RenderLine
}) {
  return (
    <article className="min-w-0 rounded-lg px-7 py-7" style={{ backgroundColor: 'var(--rt-paper)' }} aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-3 text-[13px]" style={{ color: 'var(--rt-muted)' }}>
        <span className="tabular-nums" style={{ color: 'var(--rt-faint)' }}>
          {String(index + 1).padStart(2, '0')} / {total}
        </span>
        <span>{SCRIPT_PARTS[card.part]}</span>
        {card.slides ? <span className="pill c2 text-xs">{card.slides}</span> : null}
      </div>
      <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-foreground">{card.title}</h1>
      <p className="mb-5 mt-1 text-[15px]" style={{ color: 'var(--rt-muted)' }}>
        {card.goal}
      </p>
      {card.tone ? <p className="pill c5 mb-4 inline-block px-3 py-0.5 text-sm">{card.tone}</p> : null}

      {card.say ? (
        <ul className="grid gap-3.5">
          {card.say.map((line, lineIndex) => {
            const parsed = parseKeyQuestion(line)
            return (
              <li
                key={line}
                className="border-l-[3px] pl-4 text-[21px] leading-[1.45] text-foreground"
                style={{ borderColor: keyBorder(parsed.key) }}
              >
                {renderLine(card, lineIndex, parsed.text)}
                {parsed.key ? (
                  <span className="block">
                    <KeyTag captureKey={parsed.key} />
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {card.steps ? (
        <div className="grid gap-5">
          <div>
            <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--rt-faint)' }}>
              1 · Fale
            </p>
            <p className="border-l-[3px] pl-4 text-[22px] leading-[1.45] text-foreground" style={{ borderColor: 'rgb(var(--color-accent-rgb))' }}>
              {renderLine(card, 'fale', card.steps.fale)}
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--rt-faint)' }}>
              2 · Mostre o slide
            </p>
            <ul className="grid gap-1.5 pl-4">
              {card.steps.mostre.map((item) => (
                <li key={item} className="text-[17px] leading-[1.45]" style={{ color: 'var(--rt-muted)' }}>
                  <Line text={item} notes={notes} />
                </li>
              ))}
            </ul>
          </div>
          {card.steps.pergunte ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--rt-faint)' }}>
                3 · Pergunte
              </p>
              <p className="border-l-[3px] pl-4 text-[22px] leading-[1.45] text-foreground" style={{ borderColor: 'rgb(var(--color-accent-rgb))' }}>
                <Line text={card.steps.pergunte} notes={notes} />
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {card.beats ? (
        <ul>
          {card.beats.map(([key, rawText]) => {
            const parsed = parseKeyQuestion(rawText)
            const text = parsed.text
            return (
            <li
              key={key}
              className="grid grid-cols-1 gap-1 border-t py-3 text-[19px] leading-[1.45] text-foreground first:border-t-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4"
              style={{ borderColor: 'var(--rt-rule)' }}
            >
              <span className="pt-1 text-xs" style={{ color: 'var(--rt-faint)' }}>
                {key}
              </span>
              <span className="min-w-0" style={parsed.key ? { borderLeft: `3px solid ${keyBorder(parsed.key)}`, paddingLeft: 12 } : undefined}>
                <Line text={text} notes={notes} />
                {parsed.key ? (
                  <span className="block">
                    <KeyTag captureKey={parsed.key} />
                  </span>
                ) : null}
              </span>
            </li>
            )
          })}
        </ul>
      ) : null}

      {card.objections ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[16px]">
            <tbody>
              {SCRIPT_OBJECTIONS.map(([said, reply]) => (
                <tr key={said} className="border-t" style={{ borderColor: 'var(--rt-rule)' }}>
                  <td className="w-[34%] py-3 pr-4 align-top font-semibold text-foreground">{said}</td>
                  <td className="py-3 align-top text-foreground">
                    <Line text={reply} notes={notes} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {card.branch ? (
        <div className="mt-4 grid gap-2">
          {card.branch.map(([label, rawText]) => {
            const parsed = parseKeyQuestion(rawText)
            return (
              <p
                key={label}
                className="text-[15px]"
                style={{ color: 'var(--rt-muted)', ...(parsed.key ? { borderLeft: `3px solid ${keyBorder(parsed.key)}`, paddingLeft: 12 } : {}) }}
              >
                <strong className="font-semibold text-foreground">{label}:</strong> {renderFilled(parsed.text, notes)}
                {parsed.key ? (
                  <span className="block">
                    <KeyTag captureKey={parsed.key} />
                  </span>
                ) : null}
              </p>
            )
          })}
        </div>
      ) : null}

      {card.silence ? (
        <p className="mt-5 text-[22px] font-bold" style={{ color: 'var(--rt-silence)' }}>
          Agora fique em silêncio até ele responder.
        </p>
      ) : null}

      {card.expect ? (
        <p className="mt-5 border-t border-dashed pt-3 text-[15px]" style={{ borderColor: 'var(--rt-rule)', color: 'var(--rt-muted)' }}>
          <strong className="font-semibold text-foreground">Espere ouvir:</strong> {card.expect}
        </p>
      ) : null}
    </article>
  )
}

export default function PilotoRoteiro() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [leadName, setLeadName] = useState('')
  const [feeRate, setFeeRate] = useState<number | null>(null)
  const [script, setScript] = useState<PilotoScript>(EMPTY_PILOTO_SCRIPT)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [confirmReset, setConfirmReset] = useState(false)
  const [polishing, setPolishing] = useState<string[]>([])
  const [adapting, setAdapting] = useState<string[]>([])
  /** falas em que ele preferiu a genérica (só nesta sessão) */
  const [preferGeneric, setPreferGeneric] = useState<string[]>([])
  const adaptInFlight = useRef(new Set<string>())
  /** chamadas em andamento (campo + texto), para o blur e o "Próxima" não pedirem a mesma correção duas vezes */
  const inFlight = useRef(new Set<string>())
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(script)
  latest.current = script

  const cards = useMemo(() => {
    const installments = calcInstallments(AGENCY_DEAL_CENTS, feeRate ?? 0.1506)
    return buildScriptCards({
      list: brl(AGENCY_LIST_CENTS),
      deal: brl(AGENCY_DEAL_CENTS),
      adBudget: brl(AD_BUDGET_PER_CHANNEL_CENTS),
      installment: brl(installments.installmentCents),
      installments: INSTALLMENT_COUNT,
    })
  }, [feeRate])

  const index = Math.min(script.cardIndex, cards.length - 1)
  const card = cards[index]
  const notes = script.notes

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    getPiloto(id)
      .then((doc) => {
        if (cancelled) return
        if (!doc) {
          setNotFound(true)
          return
        }
        setLeadName(doc.input.leadCompanyName.trim())
        setFeeRate(doc.input.installmentFeeRate)
        // A empresa já vem do piloto; o resto ele diz na reunião.
        const notesFromDoc = { ...doc.script.notes }
        if (!notesFromDoc.empresa && doc.input.leadCompanyName.trim()) {
          notesFromDoc.empresa = doc.input.leadCompanyName.trim()
        }
        setScript({ ...doc.script, notes: notesFromDoc })
      })
      .catch((error) => {
        console.error('[PilotoRoteiro]', error)
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Salvamento automático das anotações no próprio piloto.
  useEffect(() => {
    if (loading || !id) return
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    setSaveState('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      setSaveState('saving')
      updatePilotoScript(id, latest.current)
        .then(() => setSaveState('saved'))
        .catch((error) => {
          console.error('[PilotoRoteiro] save', error)
          setSaveState('error')
        })
    }, SAVE_DELAY)
  }, [script, loading, id])

  useEffect(() => {
    return () => {
      if (saveTimer.current && id) {
        clearTimeout(saveTimer.current)
        void updatePilotoScript(id, latest.current)
      }
    }
  }, [id])

  useEffect(() => {
    if (!startedAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  /** Frases do roteiro em que a anotação entra, para a IA encaixar o texto nelas. */
  function usagesOf(key: string): string[] {
    const token = `{${key}}`
    const lines = cards.flatMap((c) => [
      ...(c.say ?? []),
      ...(c.beats ?? []).map(([, text]) => text),
      ...(c.steps ? [c.steps.fale, ...c.steps.mostre, c.steps.pergunte ?? ''] : []),
    ])
    return lines
      .filter((line) => line.includes(token))
      .map((line) => parseKeyQuestion(line).text.split('#')[0].replace(token, '{campo}'))
  }

  /** A anotação aparece numa frase da própria ficha? Então corrige ao sair do campo, sem esperar o "Próxima". */
  function usedOnCard(target: ScriptCard, key: string): boolean {
    const token = `{${key}}`
    const lines = [
      ...(target.say ?? []),
      ...(target.beats ?? []).map(([, text]) => text),
      ...(target.steps ? [target.steps.fale, ...target.steps.mostre, target.steps.pergunte ?? ''] : []),
    ]
    return lines.some((line) => line.includes(token))
  }

  /** Corrige uma anotação que mudou desde a última correção. Não bloqueia nada. */
  function polishKey(key: string) {
    const capture = SCRIPT_CAPTURES[key]
    const sent = latest.current.notes[key] ?? ''
    const flight = `${key}\u0000${sent}`
    if (!capture?.polish || !sent.trim() || latest.current.settled[key] === sent || inFlight.current.has(flight)) {
      return
    }
    inFlight.current.add(flight)
    {
      setPolishing((current) => [...current, key])
      void polishScriptNote({ label: capture.label, text: sent, usages: usagesOf(key) })
        .then((text) => {
          setScript((current) => {
            if (current.notes[key] !== sent) {
              return current
            }
            if (text === sent.trim()) {
              return { ...current, settled: { ...current.settled, [key]: sent } }
            }
            return {
              ...current,
              notes: { ...current.notes, [key]: text },
              raw: { ...current.raw, [key]: sent },
              settled: { ...current.settled, [key]: text },
            }
          })
        })
        .finally(() => {
          inFlight.current.delete(flight)
          setPolishing((current) => current.filter((item) => item !== key))
        })
    }
  }

  /** Ao sair de uma ficha: corrige as anotações dela que ainda não foram corrigidas. */
  function polishCardNotes(target: ScriptCard) {
    for (const key of target.capture ?? []) {
      polishKey(key)
    }
  }

  function handleFieldBlur(key: string) {
    if (usedOnCard(card, key)) {
      polishKey(key)
    }
  }

  /** Resposta pronta pra personalizar: preenchida e, se passa pela correção, já corrigida. */
  function readyAnswer(key: string, source: PilotoScript = script): string | null {
    const value = (source.notes[key] ?? '').trim()
    if (!value) return null
    const capture = SCRIPT_CAPTURES[key]
    if (capture?.polish && source.settled[key] !== source.notes[key]) return null
    return value
  }

  /** Assinatura das respostas usadas; null enquanto faltar alguma obrigatória. */
  function adaptSignature(adapt: ScriptAdapt, source: PilotoScript = script): string | null {
    const required = adapt.from.map((key) => readyAnswer(key, source))
    if (required.some((value) => value === null)) return null
    const keys = [...adapt.from, ...(adapt.also ?? [])]
    // A versão e o objetivo da fala entram na assinatura: mudou a instrução, as falas antigas são refeitas.
    return JSON.stringify([ADAPT_VERSION, adapt.brief, keys.map((key) => [key, readyAnswer(key, source) ?? ''])])
  }

  const adaptId = (card: ScriptCard, target: number | 'fale') => `${card.title}|${target}`

  function genericText(card: ScriptCard, target: number | 'fale'): string {
    const raw = parseKeyQuestion(target === 'fale' ? card.steps?.fale ?? '' : card.say?.[target] ?? '').text
    return raw.split('#')[0].replace(/\{(\w+)\}/g, (_, key: string) => (notes[key] ?? '').trim() || SCRIPT_CAPTURES[key]?.label.toLowerCase() || '')
  }

  // Gera as falas personalizadas em segundo plano, assim que as respostas de que dependem ficam prontas.
  useEffect(() => {
    if (loading) return
    const timer = setTimeout(() => {
      const snapshot = latest.current
      for (const c of cards) {
        for (const adapt of c.adapt ?? []) {
          const id = adaptId(c, adapt.target)
          const sig = adaptSignature(adapt, snapshot)
          if (!sig || snapshot.adapted[id]?.sig === sig || adaptInFlight.current.has(id + sig)) continue
          adaptInFlight.current.add(id + sig)
          setAdapting((current) => [...current, id])
          const answers = [...adapt.from, ...(adapt.also ?? [])]
            .map((key) => ({ label: SCRIPT_CAPTURES[key]?.label ?? key, value: readyAnswer(key, snapshot) ?? '' }))
            .filter((answer) => answer.value)
          void personalizeScriptLine({
            brief: adapt.brief,
            generic: genericText(c, adapt.target),
            answers,
            company: (snapshot.notes.empresa ?? '').trim(),
            name: (snapshot.notes.nome ?? '').trim(),
          })
            .then((text) => {
              if (!text) return
              setScript((current) =>
                adaptSignature(adapt, current) === sig
                  ? { ...current, adapted: { ...current.adapted, [id]: { sig, text } } }
                  : current,
              )
            })
            .finally(() => {
              adaptInFlight.current.delete(id + sig)
              setAdapting((current) => current.filter((item) => item !== id))
            })
        }
      }
    }, 1200)
    return () => clearTimeout(timer)
    // as funções de apoio só leem estado/refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script.notes, script.settled, loading, cards])

  const renderLine: RenderLine = (c, target, text) => {
    const adapt = c.adapt?.find((item) => item.target === target)
    const tip = text.split('#')[1]
    if (!adapt) return <Line text={text} notes={notes} />
    const id = adaptId(c, target)
    const sig = adaptSignature(adapt)
    const stored = script.adapted[id]
    const ready = Boolean(sig && stored && stored.sig === sig)
    const generic = preferGeneric.includes(id)
    const small = (content: ReactNode) => (
      <span className="mt-1 block text-xs" style={{ color: 'var(--rt-faint)' }}>
        {content}
      </span>
    )
    if (ready && !generic) {
      return (
        <>
          <span>{stored.text}</span>
          {tip ? <span className="mt-1 block text-sm" style={{ color: 'var(--rt-muted)' }}>{tip}</span> : null}
          {small(
            <>
              Personalizado ·{' '}
              <button type="button" className="underline transition-colors hover:text-foreground" onClick={() => setPreferGeneric((current) => [...current, id])}>
                usar a genérica
              </button>
            </>,
          )}
        </>
      )
    }
    return (
      <>
        <Line text={text} notes={notes} />
        {adapting.includes(id)
          ? small('Personalizando…')
          : ready && generic
            ? small(
                <button type="button" className="underline transition-colors hover:text-foreground" onClick={() => setPreferGeneric((current) => current.filter((item) => item !== id))}>
                  usar a personalizada
                </button>,
              )
            : null}
      </>
    )
  }

  function undoPolish(key: string) {
    setScript((current) => {
      const original = current.raw[key]
      if (original === undefined) {
        return current
      }
      const raw = { ...current.raw }
      delete raw[key]
      return {
        ...current,
        notes: { ...current.notes, [key]: original },
        settled: { ...current.settled, [key]: original },
        raw,
      }
    })
  }

  function go(next: number) {
    const target = Math.max(0, Math.min(cards.length - 1, next))
    if (target !== index) {
      polishCardNotes(card)
    }
    setScript((current) => ({ ...current, cardIndex: target }))
    window.scrollTo({ top: 0 })
  }

  function setNote(key: string, value: string) {
    setScript((current) => ({ ...current, notes: { ...current.notes, [key]: value } }))
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea')) return
      if (event.key === 'ArrowRight') go(index + 1)
      if (event.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-lg font-semibold text-foreground">Piloto não encontrado</p>
        <Link to="/?tab=pilotos" className="text-sm text-muted-foreground underline">
          Voltar para Piloto 45
        </Link>
      </div>
    )
  }

  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const filledKeys = Object.keys(SCRIPT_CAPTURES).filter((key) => SCRIPT_CAPTURES[key].color && (notes[key] ?? '').trim())
  const next = cards[index + 1]
  const saveLabel: Record<SaveState, string> = {
    idle: '',
    pending: 'Não salvo',
    saving: 'Salvando…',
    saved: 'Salvo',
    error: 'Erro ao salvar',
  }

  return (
    <div className="rt min-h-screen bg-background pb-28">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link
            to={`/piloto/${id}`}
            className="text-sm text-muted-foreground transition-colors hover:text-accent"
            aria-label="Voltar para o piloto"
          >
            ←
          </Link>
          <p className="text-base font-bold text-foreground">
            Roteiro <span className="font-medium text-muted-foreground">· {leadName || 'Piloto 45'}</span>
          </p>
          <span className="flex-1" />
          <span className="text-xs text-muted-foreground" role="status">
            {saveLabel[saveState]}
          </span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            Tempo <strong className="tabular-nums text-foreground">{clock}</strong>
            <button
              type="button"
              onClick={() => setStartedAt(startedAt ? null : Date.now())}
              className="rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              {startedAt ? 'Zerar' : 'Iniciar'}
            </button>
          </span>
          {confirmReset ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              Apagar as anotações?
              <button
                type="button"
                className="rounded border border-status-error px-2.5 py-1 text-status-error transition-colors hover:bg-status-error/10"
                onClick={() => {
                  setScript({ notes: leadName ? { empresa: leadName } : {}, cardIndex: 0, raw: {}, settled: {}, adapted: {} })
                  setStartedAt(null)
                  setConfirmReset(false)
                }}
              >
                Apagar
              </button>
              <button type="button" className="rounded border border-border px-2.5 py-1 text-foreground" onClick={() => setConfirmReset(false)}>
                Manter
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              Nova reunião
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6">
        <nav className="flex flex-wrap gap-4 py-4" aria-label="Fichas">
          {SCRIPT_PARTS.map((part, partIndex) => (
            <div key={part} className="flex items-center gap-1">
              <span className="mr-1 text-xs" style={{ color: 'var(--rt-faint)' }}>
                {part}
              </span>
              {cards.map((c, n) =>
                c.part === partIndex ? (
                  <button
                    key={n}
                    type="button"
                    onClick={() => go(n)}
                    aria-label={`Ficha ${n + 1}: ${c.title}`}
                    aria-current={n === index ? 'step' : undefined}
                    className="h-1.5 w-6 rounded-full transition-colors"
                    style={{
                      backgroundColor: n === index ? 'rgb(var(--color-accent-rgb))' : n < index ? 'var(--rt-faint)' : 'var(--rt-rule)',
                    }}
                  />
                ) : null,
              )}
            </div>
          ))}
        </nav>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Card card={card} index={index} total={cards.length} notes={notes} renderLine={renderLine} />

          <aside className="grid min-w-0 gap-5 lg:sticky lg:top-20">
            {card.capture?.length ? (
              <div className="grid gap-3.5">
                <p className="text-sm" style={{ color: 'var(--rt-muted)' }}>
                  Anote o que ele disser
                </p>
                {card.capture.map((key) => {
                  const capture = SCRIPT_CAPTURES[key]
                  const fieldId = `rt-${key}`
                  const common =
                    'w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none'
                  return (
                    <div key={key} className="grid gap-1.5">
                      <label htmlFor={fieldId} className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                        {capture.color ? <span className={`${capture.color} h-3 w-3 rounded-sm`} aria-hidden /> : null}
                        {capture.label}
                      </label>
                      {capture.short ? (
                        <input
                          id={fieldId}
                          value={notes[key] ?? ''}
                          placeholder={capture.hint}
                          onChange={(event) => setNote(key, event.target.value)}
                          onBlur={() => handleFieldBlur(key)}
                          className={common}
                        />
                      ) : (
                        <textarea
                          id={fieldId}
                          value={notes[key] ?? ''}
                          placeholder={capture.hint}
                          rows={2}
                          onChange={(event) => setNote(key, event.target.value)}
                          onBlur={() => handleFieldBlur(key)}
                          className={`${common} resize-y`}
                        />
                      )}
                      {polishing.includes(key) ? (
                        <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                          Corrigindo…
                        </p>
                      ) : script.raw[key] !== undefined && notes[key] === script.settled[key] ? (
                        <p className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                          Corrigido pela IA ·{' '}
                          <button type="button" onClick={() => undoPolish(key)} className="underline transition-colors hover:text-foreground">
                            desfazer
                          </button>
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            <div className="rounded-lg px-5 py-4" style={{ backgroundColor: 'var(--rt-paper)' }}>
              <p className="mb-2 text-sm" style={{ color: 'var(--rt-muted)' }}>
                O que ele já disse
              </p>
              {filledKeys.length ? (
                <ul className="grid gap-2">
                  {filledKeys.map((key) => (
                    <li key={key} className="grid gap-0.5 text-sm">
                      <small className="text-xs" style={{ color: 'var(--rt-faint)' }}>
                        {SCRIPT_CAPTURES[key].label}
                      </small>
                      <span>
                        <span className={`pill ${SCRIPT_CAPTURES[key].color}`}>{notes[key]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm" style={{ color: 'var(--rt-faint)' }}>
                  As respostas aparecem aqui, na cor de cada uma, conforme você anota.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background px-6 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className="whitespace-nowrap rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm text-muted-foreground">
            {next ? (
              <>
                Próxima: <strong className="text-foreground">{next.title}</strong>
              </>
            ) : (
              <strong className="text-foreground">Última ficha</strong>
            )}
          </p>
          <button
            type="button"
            disabled={!next}
            onClick={() => go(index + 1)}
            className="whitespace-nowrap rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  )
}

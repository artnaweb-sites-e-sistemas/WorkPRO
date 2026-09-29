import { cn } from '../lib/cn'
import type { PilotoAiContent } from '../types/piloto'

interface PilotoContentEditorProps {
  content: PilotoAiContent
  onChange: (next: PilotoAiContent) => void
  disabled?: boolean
}

function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span
      className={cn(
        'text-xs font-semibold tabular-nums',
        over ? 'text-status-error' : 'text-muted-foreground',
      )}
    >
      {value.length}/{max}
    </span>
  )
}

const bareInputClassName =
  'min-w-0 w-full border-0 bg-transparent py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60'
const bareTextareaClassName =
  'min-w-0 w-full resize-y border-0 bg-transparent py-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60'

export function PilotoContentEditor({
  content,
  onChange,
  disabled = false,
}: PilotoContentEditorProps) {
  function patch(partial: Partial<PilotoAiContent>) {
    onChange({ ...content, ...partial })
  }

  function updateDiagnosisLine(index: number, text: string) {
    const next = [...content.diagnosisLines]
    next[index] = text
    while (next.length < 3) {
      next.push('')
    }
    patch({ diagnosisLines: next.slice(0, 3) })
  }

  function updateAdAngle(
    index: number,
    partial: Partial<PilotoAiContent['adAngles'][number]>,
  ) {
    const next = content.adAngles.map((angle, i) =>
      i === index ? { ...angle, ...partial } : angle,
    )
    while (next.length < 3) {
      next.push({ title: '', description: '' })
    }
    patch({ adAngles: next.slice(0, 3) })
  }

  const diagnosisLines = [0, 1, 2].map((index) => content.diagnosisLines[index] ?? '')
  const adAngles = [0, 1, 2].map(
    (index) => content.adAngles[index] ?? { title: '', description: '' },
  )

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="kinetic-label">Diagnóstico — título</p>
          <CharCount value={content.diagnosisHeadline} max={70} />
        </div>
        <div className="border-y border-border">
          <input
            type="text"
            value={content.diagnosisHeadline}
            disabled={disabled}
            onChange={(event) => patch({ diagnosisHeadline: event.target.value })}
            aria-label="Diagnóstico — título"
            className={bareInputClassName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="kinetic-label">Diagnóstico — linhas</p>
        <ul className="divide-y divide-border border-y border-border">
          {diagnosisLines.map((line, index) => (
            <li key={index} className="space-y-1">
              <div className="flex justify-end pt-2">
                <CharCount value={line} max={130} />
              </div>
              <textarea
                value={line}
                disabled={disabled}
                rows={2}
                onChange={(event) => updateDiagnosisLine(index, event.target.value)}
                aria-label={`Diagnóstico — linha ${index + 1}`}
                className={bareTextareaClassName}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="kinetic-label">Funil</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              { key: 'funnelTopLabel' as const, label: 'Atrair' },
              { key: 'funnelMiddleLabel' as const, label: 'Qualificar' },
              { key: 'funnelBottomLabel' as const, label: 'Vender' },
            ] as const
          ).map((field) => (
            <div key={field.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">{field.label}</p>
                <CharCount value={content[field.key]} max={60} />
              </div>
              <div className="border-y border-border">
                <input
                  type="text"
                  value={content[field.key]}
                  disabled={disabled}
                  onChange={(event) => patch({ [field.key]: event.target.value })}
                  aria-label={`Funil — ${field.label}`}
                  className={bareInputClassName}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="kinetic-label">Ângulos de anúncio</p>
        <ul className="divide-y divide-border border-y border-border">
          {adAngles.map((angle, index) => (
            <li key={index} className="grid gap-3 py-2 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">Título</p>
                  <CharCount value={angle.title} max={40} />
                </div>
                <input
                  type="text"
                  value={angle.title}
                  disabled={disabled}
                  onChange={(event) => updateAdAngle(index, { title: event.target.value })}
                  aria-label={`Ângulo ${index + 1} — título`}
                  className={bareInputClassName}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">Descrição</p>
                  <CharCount value={angle.description} max={110} />
                </div>
                <input
                  type="text"
                  value={angle.description}
                  disabled={disabled}
                  onChange={(event) =>
                    updateAdAngle(index, { description: event.target.value })
                  }
                  aria-label={`Ângulo ${index + 1} — descrição`}
                  className={bareInputClassName}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="kinetic-label">Encerramento</p>
          <CharCount value={content.closingParagraph} max={200} />
        </div>
        <div className="border-y border-border">
          <textarea
            value={content.closingParagraph}
            disabled={disabled}
            rows={3}
            onChange={(event) => patch({ closingParagraph: event.target.value })}
            aria-label="Encerramento"
            className={bareTextareaClassName}
          />
        </div>
      </div>
    </div>
  )
}

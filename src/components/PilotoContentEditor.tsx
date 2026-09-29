import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { getPilotoSlideIndex, SLIDE_INDEX } from './piloto'
import type { PilotoAiContent } from '../types/piloto'
import { PILOTO_TEXT_LIMITS as L } from '../types/piloto'

export type PilotoTextSection = keyof typeof SLIDE_INDEX

interface PilotoContentEditorProps {
  content: PilotoAiContent
  onChange: (next: PilotoAiContent) => void
  disabled?: boolean
  /** seção aberta; null fecha todas */
  openSection: PilotoTextSection | null
  onOpenSectionChange: (section: PilotoTextSection | null) => void
  showContinuation?: boolean
}

/** Só avisa quando está perto do limite: contador permanente é ruído. */
function LimitHint({ value, max }: { value: string; max: number }) {
  const length = value.length
  if (length <= max * 0.85) {
    return null
  }
  const over = length - max
  return (
    <span
      className={cn(
        'shrink-0 text-xs font-medium tabular-nums normal-case',
        over > 0 ? 'text-status-error' : 'text-muted-foreground',
      )}
    >
      {over > 0 ? `${over} acima do limite` : `faltam ${max - length}`}
    </span>
  )
}

const fieldClassName =
  'w-full border-b-2 border-transparent bg-surface-2 px-3 py-2.5 text-[15px] font-medium normal-case text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none disabled:opacity-60'

function Field({
  label,
  value,
  max,
  onChange,
  disabled,
  multiline = false,
  rows = 2,
  emphasis = false,
}: {
  label?: string
  value: string
  max: number
  onChange: (value: string) => void
  disabled?: boolean
  multiline?: boolean
  rows?: number
  emphasis?: boolean
}) {
  return (
    <div>
      {label || value.length > max * 0.85 ? (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {label ? <span className="text-xs font-medium normal-case text-muted-foreground">{label}</span> : <span />}
          <LimitHint value={value} max={max} />
        </div>
      ) : null}
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          className={cn(fieldClassName, 'resize-none leading-relaxed', emphasis && 'font-semibold')}
        />
      ) : (
        <input
          type="text"
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
          className={cn(fieldClassName, emphasis && 'font-semibold')}
        />
      )}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0 text-muted-foreground', open && 'rotate-180')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function Section({
  title,
  slideNumber,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  slideNumber: number
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm font-semibold normal-case text-foreground">
            {title}
            <span className="text-xs font-medium tabular-nums text-muted-foreground">slide {slideNumber}</span>
          </p>
          {!open ? (
            <p className="mt-1 truncate text-sm normal-case text-muted-foreground">
              {summary || 'Ainda sem texto'}
            </p>
          ) : null}
        </div>
        <Chevron open={open} />
      </button>
      {open ? <div className="space-y-4 pb-6">{children}</div> : null}
    </div>
  )
}

export function PilotoContentEditor({
  content,
  onChange,
  disabled = false,
  openSection,
  onOpenSectionChange,
  showContinuation = false,
}: PilotoContentEditorProps) {
  function patch(partial: Partial<PilotoAiContent>) {
    onChange({ ...content, ...partial })
  }

  function toggle(section: PilotoTextSection) {
    onOpenSectionChange(openSection === section ? null : section)
  }

  function slideNumber(section: PilotoTextSection): number {
    return getPilotoSlideIndex(section, showContinuation) + 1
  }

  const lines = [0, 1, 2].map((index) => content.diagnosisLines[index] ?? '')
  const angles = [0, 1, 2].map((index) => content.adAngles[index] ?? { title: '', description: '' })

  function updateLine(index: number, text: string) {
    patch({ diagnosisLines: lines.map((line, i) => (i === index ? text : line)) })
  }

  const chat = [0, 1, 2, 3].map((index) => content.chatMessages?.[index] ?? '')

  function updateChat(index: number, text: string) {
    patch({ chatMessages: chat.map((message, i) => (i === index ? text : message)) })
  }

  function updateAngle(index: number, partial: Partial<PilotoAiContent['adAngles'][number]>) {
    patch({ adAngles: angles.map((angle, i) => (i === index ? { ...angle, ...partial } : angle)) })
  }

  const funnelFields = [
    { key: 'funnelTopLabel' as const, label: 'Atrair' },
    { key: 'funnelMiddleLabel' as const, label: 'Qualificar' },
    { key: 'funnelBottomLabel' as const, label: 'Vender' },
  ]

  return (
    <div className="divide-y divide-border">
      <Section
        title="Diagnóstico"
        slideNumber={slideNumber('diagnostico')}
        summary={content.diagnosisHeadline}
        open={openSection === 'diagnostico'}
        onToggle={() => toggle('diagnostico')}
      >
        <Field
          label="Frase principal"
          value={content.diagnosisHeadline}
          max={L.diagnosisHeadline}
          onChange={(value) => patch({ diagnosisHeadline: value })}
          disabled={disabled}
          multiline
          emphasis
        />
        {lines.map((line, index) => (
          <Field
            key={index}
            label={`Linha ${index + 1}`}
            value={line}
            max={L.diagnosisLine}
            onChange={(value) => updateLine(index, value)}
            disabled={disabled}
            multiline
          />
        ))}
      </Section>

      <Section
        title="Caminho do cliente"
        slideNumber={slideNumber('funil')}
        summary={funnelFields.map((field) => content[field.key]).filter(Boolean).join(' · ')}
        open={openSection === 'funil'}
        onToggle={() => toggle('funil')}
      >
        {funnelFields.map((field) => (
          <Field
            key={field.key}
            label={field.label}
            value={content[field.key]}
            max={L.funnelLabel}
            onChange={(value) => patch({ [field.key]: value })}
            disabled={disabled}
          />
        ))}
      </Section>

      <Section
        title="Ideias dos vídeos"
        slideNumber={slideNumber('videos')}
        summary={angles.map((angle) => angle.title).filter(Boolean).join(' · ')}
        open={openSection === 'videos'}
        onToggle={() => toggle('videos')}
      >
        {angles.map((angle, index) => (
          <div key={index} className="space-y-2">
            <Field
              label={`Vídeo ${index + 1}`}
              value={angle.title}
              max={L.angleTitle}
              onChange={(value) => updateAngle(index, { title: value })}
              disabled={disabled}
              emphasis
            />
            <Field
              value={angle.description}
              max={L.angleDescription}
              onChange={(value) => updateAngle(index, { description: value })}
              disabled={disabled}
              multiline
            />
          </div>
        ))}
      </Section>

      <Section
        title="Conversa no WhatsApp"
        slideNumber={slideNumber('conversa')}
        summary={chat.filter(Boolean).join(' · ')}
        open={openSection === 'conversa'}
        onToggle={() => toggle('conversa')}
      >
        <p className="text-xs normal-case text-muted-foreground">
          Exemplo de como a IA conversaria com um cliente deste negócio. Em branco, entra uma conversa genérica.
        </p>
        {chat.map((message, index) => (
          <Field
            key={index}
            label={index % 2 === 0 ? 'Cliente' : 'IA'}
            value={message}
            max={L.chatMessage}
            onChange={(value) => updateChat(index, value)}
            disabled={disabled}
            multiline
          />
        ))}
      </Section>

      <Section
        title="Encerramento"
        slideNumber={slideNumber('fechamento')}
        summary={content.closingParagraph}
        open={openSection === 'fechamento'}
        onToggle={() => toggle('fechamento')}
      >
        <Field
          value={content.closingParagraph}
          max={L.closingParagraph}
          onChange={(value) => patch({ closingParagraph: value })}
          disabled={disabled}
          multiline
          rows={3}
        />
      </Section>
    </div>
  )
}

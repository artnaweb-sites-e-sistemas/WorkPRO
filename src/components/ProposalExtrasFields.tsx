import { useState } from 'react'
import type { DragEvent } from 'react'
import { Button, Switch } from './ui'
import { maskCurrencyBRLInput } from '../lib/currencyBRL'
import { cn } from '../lib/cn'

export interface ExtraDraft {
  title: string
  amountDisplay: string
  source: 'ai' | 'manual'
  recurring: boolean
}

interface ProposalExtrasFieldsProps {
  items: ExtraDraft[]
  onChange: (items: ExtraDraft[]) => void
  aiSuggest: boolean
  onAiSuggestChange: (value: boolean) => void
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  )
}

function reorderItems(items: ExtraDraft[], from: number, to: number): ExtraDraft[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function ProposalExtrasFields({
  items,
  onChange,
  aiSuggest,
  onAiSuggestChange,
}: ProposalExtrasFieldsProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function update(index: number, partial: Partial<ExtraDraft>) {
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, ...partial, source: 'manual' } : item,
      ),
    )
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...items, { title: '', amountDisplay: '', source: 'manual', recurring: false }])
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
    setOverIndex(index)
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, index: number) {
    event.preventDefault()
    if (overIndex !== index) {
      setOverIndex(index)
    }
  }

  function handleDrop(index: number) {
    if (dragIndex == null) {
      return
    }

    onChange(reorderItems(items, dragIndex, index))
    setDragIndex(null)
    setOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="space-y-2">
      <Switch
        checked={aiSuggest}
        onChange={onAiSuggestChange}
        label="IA sugere os adicionais"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="kinetic-label">Itens</p>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs normal-case text-muted-foreground">
          {aiSuggest
            ? 'Nenhum item ainda. A IA vai sugerir ao gerar a proposta.'
            : 'Nenhum adicional ainda.'}
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {items.map((item, index) => {
            const isDragging = dragIndex === index
            const isOver = overIndex === index && dragIndex !== null && dragIndex !== index

            return (
              <li
                key={index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'flex items-center gap-1 py-1 transition-colors duration-150',
                  isDragging && 'opacity-40',
                  isOver && 'bg-accent/10',
                )}
              >
                <span
                  aria-hidden
                  title="Arrastar para reordenar"
                  className="flex min-h-touch w-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                >
                  <GripIcon />
                </span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  placeholder="Título do adicional"
                  aria-label={`Título do adicional ${index + 1}`}
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={item.amountDisplay}
                  onChange={(event) =>
                    update(index, { amountDisplay: maskCurrencyBRLInput(event.target.value) })
                  }
                  placeholder="R$ 0,00"
                  aria-label={`Valor do adicional ${index + 1}`}
                  className="w-28 shrink-0 border-0 bg-transparent py-2 text-right text-base tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  aria-pressed={item.recurring}
                  onClick={() => update(index, { recurring: !item.recurring })}
                  aria-label={
                    item.recurring
                      ? `Marcar adicional ${index + 1} como valor único`
                      : `Marcar adicional ${index + 1} como mensal`
                  }
                  title={item.recurring ? 'Mensal' : 'Valor único'}
                  className={cn(
                    'shrink-0 border-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors duration-150',
                    item.recurring
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remover adicional ${index + 1}`}
                  title="Remover adicional"
                  className="min-h-touch w-8 shrink-0 text-muted-foreground transition-colors duration-150 hover:text-status-error"
                >
                  <svg
                    className="mx-auto h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs normal-case text-muted-foreground">
        {aiSuggest
          ? 'A IA vai criar os adicionais ao gerar a proposta. Itens que você digitar aqui são preservados. Marque Mensal para o valor sair como R$ x,00/mês.'
          : 'Sem valor, o item sai como "Sob consulta". Marque Mensal para o valor aparecer como R$ x,00/mês.'}
        {items.length > 1 ? ' Arraste pelo ícone para reordenar.' : null}
      </p>
    </div>
  )
}

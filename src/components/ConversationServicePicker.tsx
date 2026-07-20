import { useEffect, useId, useRef, useState } from 'react'
import type { ConversationServiceSnapshot, Service } from '../types/models'
import { cn } from '../lib/cn'
import { badgeBaseClassName } from './ui/Badge'

interface ConversationServicePickerProps {
  availableServices: Service[]
  selectedServices: ConversationServiceSnapshot[]
  onChange: (services: ConversationServiceSnapshot[]) => void
  loading?: boolean
  disabled?: boolean
  onAddNew?: () => void
}

function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}

function RemoveBadgeIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
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

export function ConversationServicePicker({
  availableServices,
  selectedServices,
  onChange,
  loading = false,
  disabled = false,
  onAddNew,
}: ConversationServicePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!open) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const selectedIds = new Set(
    availableServices
      .filter((service) =>
        selectedServices.some(
          (selected) =>
            selected.name === service.name && selected.description === service.description,
        ),
      )
      .map((service) => service.id),
  )

  function toggleService(service: Service) {
    const snapshot: ConversationServiceSnapshot = {
      name: service.name,
      description: service.description,
    }
    const isSelected = selectedServices.some(
      (selected) =>
        selected.name === snapshot.name && selected.description === snapshot.description,
    )

    if (isSelected) {
      onChange(
        selectedServices.filter(
          (selected) =>
            !(selected.name === snapshot.name && selected.description === snapshot.description),
        ),
      )
      return
    }

    onChange([...selectedServices, snapshot])
  }

  function removeService(index: number) {
    onChange(selectedServices.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="kinetic-label block">Serviços desta conversa</label>

      <button
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-12 w-full items-center gap-2 border-2 border-border bg-surface-2 px-3 py-2 text-left transition-colors duration-150',
          'hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {loading ? (
            <span className="text-sm normal-case text-muted-foreground">Carregando serviços...</span>
          ) : selectedServices.length === 0 ? (
            <span className="text-sm normal-case text-muted-foreground">
              Clique para escolher os serviços
            </span>
          ) : (
            selectedServices.map((service, index) => (
              <span
                key={`${service.name}-${index}`}
                className={cn(
                  badgeBaseClassName,
                  'gap-1 border-accent bg-accent/10 text-accent',
                )}
              >
                {service.name.trim() || 'Sem nome'}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeService(index)
                  }}
                  className="text-accent transition-colors hover:text-foreground"
                  aria-label={`Remover ${service.name.trim() || 'serviço'}`}
                >
                  <RemoveBadgeIcon />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && !loading && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Serviços disponíveis"
          aria-multiselectable="true"
          className="max-h-48 overflow-y-auto border-2 border-border bg-surface py-1"
        >
          {onAddNew && (
            <li role="presentation" className="border-b-2 border-border">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAddNew()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-accent transition-colors duration-150 hover:bg-accent/10"
              >
                <PlusIcon />
                <span className="text-xs font-bold uppercase tracking-wide">
                  Adicionar novo serviço
                </span>
              </button>
            </li>
          )}
          {availableServices.length === 0 ? (
            <li className="px-3 py-2 text-sm normal-case text-muted-foreground">
              Nenhum serviço cadastrado. Adicione um agora ou em Configurações.
            </li>
          ) : (
            availableServices.map((service) => {
              const isSelected = selectedIds.has(service.id)

              return (
                <li key={service.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleService(service)}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors duration-150',
                      isSelected
                        ? 'bg-accent/10 text-accent'
                        : 'text-foreground hover:bg-surface-2',
                    )}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {service.name.trim() || 'Sem nome'}
                    </span>
                    {service.description.trim() && (
                      <span className="line-clamp-2 text-xs normal-case text-muted-foreground">
                        {service.description.trim()}
                      </span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      <p className="text-xs normal-case text-muted-foreground">
        A IA usa nome e descrição dos serviços selecionados como contexto desta conversa.
      </p>
    </div>
  )
}

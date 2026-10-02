import { useEffect, useId, useRef, useState } from 'react'

export function HistoryFilterMenu<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: T
  options: { value: T; label: string; count: number }[]
  onChange: (value: T) => void
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    function onPointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative min-w-[12.5rem]">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-accent/60 focus:border-accent focus:outline-none"
      >
        <span className="min-w-0 truncate">
          {selected?.label}
          <span className="ml-1.5 tabular-nums" style={{ color: 'var(--rt-faint)' }}>
            ({selected?.count ?? 0})
          </span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.25}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute right-0 z-40 mt-1.5 max-h-72 w-full min-w-[14rem] overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg shadow-black/40"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    active ? 'bg-accent/15 text-foreground' : 'text-foreground hover:bg-surface-2'
                  }`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  <span className="shrink-0 tabular-nums text-xs" style={{ color: active ? 'var(--rt-muted)' : 'var(--rt-faint)' }}>
                    {option.count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

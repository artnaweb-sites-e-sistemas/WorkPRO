import { useId, useState } from 'react'

export interface NicheOption {
  key: string
  label: string
}

function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Campo de nicho com a lista dos já usados. Filtra enquanto você digita; cada item tem um "×"
 * para tirar da lista. Quem decide quando a IA roda é o `onCommit` (ao sair do campo ou escolher).
 */
export function NicheCombobox({
  id,
  value,
  placeholder,
  className,
  options,
  onChange,
  onFocus,
  onCommit,
  onDelete,
}: {
  id: string
  value: string
  placeholder: string
  className: string
  options: NicheOption[]
  onChange: (value: string) => void
  onFocus: () => void
  onCommit: () => void
  onDelete: (key: string) => void
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const term = plain(value)
  const visible = options
    .filter((option) => !term || plain(option.label).includes(term))
    .filter((option) => plain(option.label) !== term)
    .slice(0, 8)
  const showList = open && visible.length > 0

  function choose(option: NicheOption) {
    onChange(option.label)
    setOpen(false)
    setActive(-1)
    onCommit()
  }

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => {
          setOpen(true)
          onFocus()
        }}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
          onCommit()
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={(event) => {
          if (!showList) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((index) => Math.min(index + 1, visible.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((index) => Math.max(index - 1, 0))
          } else if (event.key === 'Enter' && active >= 0) {
            event.preventDefault()
            choose(visible[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        className={className}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-border py-1"
          style={{ backgroundColor: 'var(--rt-paper)' }}
        >
          {visible.map((option, index) => (
            <li
              key={option.key}
              role="option"
              aria-selected={index === active}
              className="flex items-center gap-2 px-1"
              style={index === active ? { backgroundColor: 'var(--rt-rule)' } : undefined}
            >
              {/* mousedown em vez de click: escolhe antes de o campo perder o foco */}
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(option)
                }}
                className="min-w-0 flex-1 truncate rounded px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                {option.label}
              </button>
              <button
                type="button"
                aria-label={`Tirar ${option.label} da lista`}
                title="Tirar da lista"
                onMouseDown={(event) => {
                  event.preventDefault()
                  onDelete(option.key)
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-base transition-colors hover:bg-surface-2 hover:text-status-error"
                style={{ color: 'var(--rt-faint)' }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

import { cn } from '../../lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  id?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, id, disabled }: SwitchProps) {
  const switchId = id ?? label.toLowerCase().replace(/\s/g, '-')

  return (
    <label
      htmlFor={switchId}
      className={cn(
        'flex cursor-pointer items-center gap-3',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 border-2 transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-border bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 transition-transform duration-150',
            checked ? 'translate-x-5 bg-accent-foreground' : 'bg-foreground',
          )}
        />
      </button>
      <span className="kinetic-label">{label}</span>
    </label>
  )
}

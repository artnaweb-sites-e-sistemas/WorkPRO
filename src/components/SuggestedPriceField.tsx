import { useEffect, useRef, useState } from 'react'
import {
  setSuggestedPrice,
  setSuggestedRecurringPrice,
  updateConversation,
} from '../services/conversations'
import { maskCurrencyBRLInput, normalizeCurrencyBRL } from '../lib/currencyBRL'
import { cn } from '../lib/cn'
import { Switch } from './ui'

interface BudgetPriceFieldsProps {
  conversationId: string
  suggestedPrice: string | null
  suggestedRecurringPrice?: string | null
  isRecurring: boolean
  showSwitch?: boolean
  autoSave?: boolean
  className?: string
}

interface SuggestedPriceFieldProps extends BudgetPriceFieldsProps {
  onSave?: (formattedPrice: string | null) => void
  onRecurringSave?: (formattedPrice: string | null) => void
}

interface BudgetPriceInputProps {
  badge: string
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
  onBlur: () => void
}

function BudgetPriceInput({
  badge,
  value,
  disabled = false,
  placeholder = 'R$ 0,00',
  onChange,
  onBlur,
}: BudgetPriceInputProps) {
  const isOrcamentoBadge = badge === 'Orçamento'

  return (
    <div className="relative min-w-0 flex-1 pt-2">
      <div className="relative">
        <span
          className={cn(
            'absolute left-3 top-0 z-10 -translate-y-1/2',
            'border px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide',
            isOrcamentoBadge
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-border bg-surface text-muted-foreground',
          )}
        >
          {badge}
        </span>

        <input
          type="text"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(
            'kinetic-input h-12 min-h-0 w-full px-3 py-0 leading-normal',
            disabled && 'cursor-not-allowed border-border/60 bg-surface-2/40 text-muted-foreground',
          )}
        />
      </div>
    </div>
  )
}

function usePersistedCurrencyPrice(
  conversationId: string,
  storedValue: string | null,
  persist: (id: string, price: string | null) => Promise<void>,
  autoSave: boolean,
  onSave?: (formattedPrice: string | null) => void,
) {
  const [priceInput, setPriceInput] = useState(() => normalizeCurrencyBRL(storedValue))
  const lastSavedRef = useRef(normalizeCurrencyBRL(storedValue))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const normalized = normalizeCurrencyBRL(storedValue)
    setPriceInput(normalized)
    lastSavedRef.current = normalized
  }, [storedValue])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  async function persistPrice(raw: string) {
    const formatted = raw.trim() ? normalizeCurrencyBRL(raw) : null
    const display = formatted ?? ''

    if (display === lastSavedRef.current) {
      return
    }

    await persist(conversationId, formatted)
    lastSavedRef.current = display
    onSave?.(formatted)
  }

  function handleChange(value: string) {
    const masked = maskCurrencyBRLInput(value)
    setPriceInput(masked)

    if (!autoSave) {
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      void persistPrice(masked)
    }, 600)
  }

  function handleBlur() {
    if (!autoSave) {
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    void persistPrice(priceInput)
  }

  return { priceInput, handleChange, handleBlur }
}

export function RecurringBudgetSwitch({
  conversationId,
  isRecurring,
  className,
}: {
  conversationId: string
  isRecurring: boolean
  className?: string
}) {
  const [saving, setSaving] = useState(false)

  async function handleChange(enabled: boolean) {
    setSaving(true)

    try {
      await updateConversation(conversationId, { isRecurring: enabled })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(className)}>
      <Switch
        checked={isRecurring}
        onChange={(enabled) => void handleChange(enabled)}
        disabled={saving}
        label="Manutenção recorrente"
      />
    </div>
  )
}

export function BudgetPriceFields({
  conversationId,
  suggestedPrice,
  suggestedRecurringPrice = null,
  isRecurring,
  showSwitch = false,
  autoSave = false,
  className,
  onSave,
  onRecurringSave,
}: BudgetPriceFieldsProps & {
  onSave?: (formattedPrice: string | null) => void
  onRecurringSave?: (formattedPrice: string | null) => void
}) {
  const servicePrice = usePersistedCurrencyPrice(
    conversationId,
    suggestedPrice,
    setSuggestedPrice,
    autoSave,
    onSave,
  )
  const recurringPrice = usePersistedCurrencyPrice(
    conversationId,
    suggestedRecurringPrice,
    setSuggestedRecurringPrice,
    autoSave && isRecurring,
    onRecurringSave,
  )

  return (
    <div className={cn('space-y-4', className)}>
      {showSwitch && (
        <RecurringBudgetSwitch conversationId={conversationId} isRecurring={isRecurring} />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <BudgetPriceInput
          badge="Orçamento"
          value={servicePrice.priceInput}
          placeholder="R$ 0,00"
          onChange={servicePrice.handleChange}
          onBlur={servicePrice.handleBlur}
        />
        <BudgetPriceInput
          badge="Recorrente"
          value={recurringPrice.priceInput}
          disabled={!isRecurring}
          placeholder="R$ 0,00/mês"
          onChange={recurringPrice.handleChange}
          onBlur={recurringPrice.handleBlur}
        />
      </div>
    </div>
  )
}

export function SuggestedPriceField({
  conversationId,
  suggestedPrice,
  suggestedRecurringPrice = null,
  isRecurring,
  autoSave = false,
  onSave,
  onRecurringSave,
  className,
}: SuggestedPriceFieldProps) {
  return (
    <BudgetPriceFields
      conversationId={conversationId}
      suggestedPrice={suggestedPrice}
      suggestedRecurringPrice={suggestedRecurringPrice}
      isRecurring={isRecurring}
      showSwitch
      autoSave={autoSave}
      onSave={onSave}
      onRecurringSave={onRecurringSave}
      className={className}
    />
  )
}

/** Expõe persistência para uso externo. */
export async function saveSuggestedPriceValue(
  conversationId: string,
  raw: string,
): Promise<string | null> {
  const formatted = raw.trim() ? normalizeCurrencyBRL(raw) : null
  await setSuggestedPrice(conversationId, formatted)
  return formatted
}

export async function saveSuggestedRecurringPriceValue(
  conversationId: string,
  raw: string,
): Promise<string | null> {
  const formatted = raw.trim() ? normalizeCurrencyBRL(raw) : null
  await setSuggestedRecurringPrice(conversationId, formatted)
  return formatted
}

export { maskCurrencyBRLInput, normalizeCurrencyBRL }

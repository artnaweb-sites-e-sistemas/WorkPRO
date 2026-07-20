import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="kinetic-label block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'kinetic-input',
          error && 'border-status-error focus:border-status-error',
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs normal-case text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs normal-case text-status-error">{error}</p>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="kinetic-label block">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'kinetic-input min-h-[120px] resize-y leading-relaxed',
          error && 'border-status-error focus:border-status-error',
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="text-xs normal-case text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs normal-case text-status-error">{error}</p>}
    </div>
  )
})

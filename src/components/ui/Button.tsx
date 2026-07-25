import { motion, useReducedMotion } from 'framer-motion'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
  loading?: boolean
  copied?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-2 border-accent bg-accent text-accent-foreground hover:scale-105 active:scale-95 transition-all duration-150',
  secondary:
    'border-2 border-border bg-transparent text-foreground hover:bg-foreground hover:text-background transition-colors duration-150',
  ghost: 'border-2 border-transparent text-muted-foreground hover:text-accent transition-colors duration-150',
  danger:
    'border-2 border-status-error bg-transparent text-status-error hover:bg-status-error hover:text-background transition-colors duration-150',
  success:
    'border-2 border-status-success bg-status-success text-background hover:scale-105 active:scale-95 transition-all duration-150',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-11 px-4 text-xs min-h-touch',
  md: 'h-14 px-8 text-sm min-h-touch',
  lg: 'h-14 px-8 text-base min-h-touch',
}

const copiedStyles =
  'border-2 border-accent bg-accent text-accent-foreground transition-colors duration-200 motion-reduce:transition-none'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  loading,
  copied = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type={type}
      whileHover={
        disabled || loading || copied || reduceMotion || variant === 'secondary' || variant === 'ghost'
          ? undefined
          : { scale: 1.05 }
      }
      whileTap={
        disabled || loading || copied || reduceMotion || variant === 'secondary' || variant === 'ghost'
          ? undefined
          : { scale: 0.95 }
      }
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold uppercase tracking-tight',
        'disabled:cursor-not-allowed disabled:opacity-50',
        copied ? copiedStyles : variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...(props as object)}
    >
      {loading ? (
        <>
          <Spinner size="sm" className="text-current" label="Carregando" />
          <span>Carregando...</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  )
}

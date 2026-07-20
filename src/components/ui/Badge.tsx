import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'tag' | 'tagAccent'

export const badgeBaseClassName =
  'inline-flex items-center border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'

export const tagBaseClassName =
  'inline-flex items-center text-[10px] font-medium uppercase tracking-wider'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'border-border bg-muted text-muted-foreground',
  accent: 'border-accent bg-accent text-accent-foreground',
  success: 'border-status-success bg-transparent text-status-success',
  warning: 'border-status-warning bg-transparent text-status-warning',
  error: 'border-status-error bg-transparent text-status-error',
  info: 'border-status-info bg-transparent text-status-info',
  tag: 'text-muted-foreground',
  tagAccent: 'text-accent',
}

const TAG_VARIANTS: BadgeVariant[] = ['tag', 'tagAccent']

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const isTag = TAG_VARIANTS.includes(variant)

  return (
    <span
      data-badge-tag={isTag ? true : undefined}
      className={cn(isTag ? tagBaseClassName : badgeBaseClassName, variants[variant], className)}
    >
      {children}
    </span>
  )
}

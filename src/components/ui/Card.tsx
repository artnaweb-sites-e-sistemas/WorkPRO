import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  className,
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={cn('border-2 border-border bg-surface', paddingMap[padding], className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('kinetic-heading text-base tracking-tight', className)}>{children}</h3>
  )
}

export function CardDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn('mt-1 text-sm normal-case text-muted-foreground', className)}>{children}</p>
}

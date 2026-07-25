import { cn } from '../../lib/cn'

type SpinnerSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
}

interface SpinnerProps {
  className?: string
  size?: SpinnerSize
  label?: string
}

/** Preloader do sistema — arco angular alinhado ao visual kinetic. */
export function Spinner({ className, size = 'md', label = 'Carregando' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('relative inline-flex items-center justify-center', sizeMap[size], className)}
    >
      <svg className="h-full w-full animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-border"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
          className="text-accent"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden
    >
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

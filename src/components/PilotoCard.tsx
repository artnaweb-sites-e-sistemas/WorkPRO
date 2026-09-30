import { Link } from 'react-router-dom'
import type { PilotoDoc } from '../types/piloto'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { getPilotoPlans } from '../lib/pilotoPricing'
import { Badge } from './ui/Badge'
import { cn } from '../lib/cn'

const STATUS_LABEL: Record<PilotoDoc['status'], string> = {
  ativo: 'Ativa',
  fechado: 'Fechada',
  perdido: 'Perdida',
}

interface PilotoCardProps {
  piloto: PilotoDoc
  className?: string
}

export function PilotoCard({ piloto, className }: PilotoCardProps) {
  const path = `/piloto/${piloto.id}`
  const title = piloto.input.leadCompanyName.trim() || 'Sem nome'
  const niche = piloto.input.leadNiche.trim()
  const city = piloto.input.leadCity.trim()
  const secondary = [niche, city].filter(Boolean).join(' · ')
  const completo = getPilotoPlans(piloto.input.pricing).find((plan) => plan.id === 'completo')
  const amountLabel = formatCurrencyBRL(completo?.totalCents ?? 0)
  const isClosed = piloto.status === 'fechado'
  const isActive = piloto.status === 'ativo'

  return (
    <div
      className={cn(
        'group border-2 bg-surface transition-colors duration-300',
        isClosed
          ? 'border-status-success bg-status-success/5 hover:bg-status-success/10'
          : isActive
            ? 'border-border hover:bg-accent/10'
            : 'border-border hover:bg-status-error/10',
        className,
      )}
    >
      <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            to={path}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <p className="text-base font-bold uppercase tracking-tight text-foreground transition-colors duration-300">
              {title}
            </p>
          </Link>

          {secondary ? (
            <Link
              to={path}
              className="mt-1 block min-w-0 truncate text-sm normal-case text-muted-foreground transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {secondary}
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge variant={isClosed ? 'success' : isActive ? 'tagAccent' : 'error'}>
            {STATUS_LABEL[piloto.status]}
          </Badge>
          <Badge variant="default" className="tabular-nums normal-case tracking-normal">
            {amountLabel}
          </Badge>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300">
            {formatRelativeTime(piloto.updatedAt ?? piloto.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

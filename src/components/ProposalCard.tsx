import { Link } from 'react-router-dom'
import type { ProposalDoc } from '../types/proposalDoc'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { Badge } from './ui/Badge'
import { cn } from '../lib/cn'

const STATUS_LABEL: Record<ProposalDoc['status'], string> = {
  ativo: 'Ativa',
  fechado: 'Fechada',
  perdido: 'Perdida',
}

interface ProposalCardProps {
  proposal: ProposalDoc
  className?: string
}

export function ProposalCard({ proposal, className }: ProposalCardProps) {
  const proposalPath = `/proposta/${proposal.id}`
  const listTitle =
    proposal.input.tagline.trim() ||
    proposal.input.companyName.trim() ||
    'Sem nome'
  const projectTitle = proposal.content.projectTitle.trim() || 'Proposta sem título'
  const amountLabel =
    proposal.input.amountCents > 0 ? formatCurrencyBRL(proposal.input.amountCents) : 'Sem valor'
  const isClosed = proposal.status === 'fechado'
  const isActive = proposal.status === 'ativo'

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
            to={proposalPath}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <p className="text-base font-bold uppercase tracking-tight text-foreground transition-colors duration-300">
              {listTitle}
            </p>
          </Link>

          <Link
            to={proposalPath}
            className="mt-1 block min-w-0 truncate text-sm normal-case text-muted-foreground transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {projectTitle}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge
            variant={
              isClosed ? 'success' : isActive ? 'tagAccent' : 'error'
            }
          >
            {STATUS_LABEL[proposal.status]}
          </Badge>
          <Badge variant="default" className="tabular-nums normal-case tracking-normal">
            {amountLabel}
          </Badge>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors duration-300">
            {formatRelativeTime(proposal.updatedAt ?? proposal.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

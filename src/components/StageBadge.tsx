import type { Stage } from '../types/models'
import { Badge } from './ui'

const STAGE_LABELS: Record<Stage, string> = {
  abordagem: 'Abordagem',
  relacionamento: 'Relacionamento',
  videocall: 'Vídeo chamada',
  orcamento: 'Orçamento',
  fechamento: 'Fechamento',
}

const STAGE_VARIANTS: Record<Stage, 'tag' | 'tagAccent'> = {
  abordagem: 'tag',
  relacionamento: 'tagAccent',
  videocall: 'tag',
  orcamento: 'tagAccent',
  fechamento: 'tag',
}

interface StageBadgeProps {
  stage: Stage
}

export function StageBadge({ stage }: StageBadgeProps) {
  const label = STAGE_LABELS[stage]

  return <Badge variant={STAGE_VARIANTS[stage]}>{label}</Badge>
}

const STATUS_LABELS = {
  ativo: 'Ativo',
  fechado: 'Fechado',
  perdido: 'Perdido',
} as const

const STATUS_VARIANTS = {
  ativo: 'success',
  fechado: 'default',
  perdido: 'error',
} as const

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

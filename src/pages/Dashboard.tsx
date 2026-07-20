import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ConversationCard } from '../components/ConversationCard'
import { NewConversationModal } from '../components/NewConversationModal'
import { ProfileSettingsModal } from '../components/ProfileSettingsModal'
import { useAuth } from '../context/AuthContext'
import { listConversations } from '../services/conversations'
import type { Conversation, ConversationStatus, Stage } from '../types/models'
import { matchesConversationSearch } from '../lib/search'
import { staggerContainer, staggerItem } from '../lib/motion'
import { cn } from '../lib/cn'
import { Button, Card } from '../components/ui'

type StatusFilter = ConversationStatus | 'todos'
type DashboardStageFilter = Exclude<Stage, 'videocall'>
type StageFilter = DashboardStageFilter | 'todos'

const PAGE_SIZE = 5

const STAGE_FILTER_OPTIONS: { value: DashboardStageFilter; label: string }[] = [
  { value: 'abordagem', label: 'Abordagem' },
  { value: 'relacionamento', label: 'Relacionamento' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'fechamento', label: 'Fechamento' },
]

function StageFilterIcon({ stage }: { stage: DashboardStageFilter }) {
  const className = 'h-3 w-3 shrink-0'

  switch (stage) {
    case 'abordagem':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      )
    case 'relacionamento':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      )
    case 'orcamento':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 7h.01M7 3h5c.512 0 .853.192 1.12.52l4.122 4.128a1.5 1.5 0 010 2.112l-7.735 7.735a1.5 1.5 0 01-2.112 0L3.52 12.633A1.5 1.5 0 013 11.513V7a4 4 0 014-4z"
          />
        </svg>
      )
    case 'fechamento':
      return (
        <svg
          className={className}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
  }
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [stageFilter, setStageFilter] = useState<StageFilter>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, stageFilter, searchQuery])

  useEffect(() => {
    const unsubscribe = listConversations(
      (data) => {
        setConversations(data)
        setLoadError(null)
        setLoading(false)
      },
      (error) => {
        console.error('[Dashboard] listConversations error:', error)
        setLoadError(error.message)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [])

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'todos') {
      return conversations
    }

    return conversations.filter((conversation) => conversation.status === statusFilter)
  }, [conversations, statusFilter])

  const stageFiltered = useMemo(() => {
    if (stageFilter === 'todos') {
      return statusFiltered
    }

    return statusFiltered.filter((conversation) => conversation.stage === stageFilter)
  }, [statusFiltered, stageFilter])

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return stageFiltered
    }

    return stageFiltered.filter((conversation) =>
      matchesConversationSearch(
        conversation.clientName,
        conversation.projectTitle,
        searchQuery,
      ),
    )
  }, [stageFiltered, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredConversations.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedConversations = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredConversations.slice(start, start + PAGE_SIZE)
  }, [filteredConversations, safePage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todas' },
    { value: 'ativo', label: 'Ativas' },
    { value: 'fechado', label: 'Fechadas' },
    { value: 'perdido', label: 'Perdidas' },
  ]

  const hasSearch = searchQuery.trim().length > 0
  const leadCountDisplay = String(conversations.length).padStart(2, '0')
  const showPagination = filteredConversations.length > PAGE_SIZE

  function handleStageFilterChange(value: DashboardStageFilter) {
    setStageFilter((current) => (current === value ? 'todos' : value))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tighter text-foreground">
              Work<span className="text-accent">PRO</span>
            </h1>
            <p className="mt-0.5 text-sm normal-case text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
              Configurações
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-0 select-none font-bold leading-none text-muted text-[6rem] sm:text-[8rem]"
          >
            {leadCountDisplay}
          </span>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold uppercase tracking-tighter text-foreground">
              Conversas
            </h2>
            <p className="mt-2 text-base normal-case text-muted-foreground">
              {conversations.length} lead{conversations.length !== 1 ? 's' : ''} no total
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)} size="lg" className="relative z-10">
            + Nova conversa
          </Button>
        </div>

        {conversations.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={cn(
                      'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors duration-150',
                      statusFilter === tab.value
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:text-accent',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {STAGE_FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleStageFilterChange(option.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-tight transition-colors duration-150',
                      stageFilter === option.value
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:text-accent',
                    )}
                  >
                    <StageFilterIcon stage={option.value} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative mt-5">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por cliente ou projeto..."
                className="min-h-touch w-full border-2 border-border bg-surface-2 py-3 pl-10 pr-4 text-sm normal-case text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </>
        )}

        {loading ? (
          <div className="mt-16 flex justify-center">
            <span className="inline-block h-8 w-8 animate-spin border-2 border-accent border-t-transparent" />
          </div>
        ) : loadError ? (
          <p className="mt-16 border-2 border-status-error px-4 py-3 text-base normal-case text-status-error">
            Erro ao carregar conversas: {loadError}
          </p>
        ) : conversations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-16"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-4 select-none font-bold leading-none text-muted text-[6rem]"
            >
              01
            </span>
            <Card padding="lg" className="relative z-10 text-center">
              <h3 className="text-2xl font-bold uppercase tracking-tighter text-foreground">
                Comece seu primeiro lead
              </h3>
              <p className="mx-auto mt-4 max-w-md text-base normal-case leading-relaxed text-muted-foreground">
                Cole um projeto da Workana e deixe a IA extrair nome, título e gerar suas
                mensagens de abordagem em segundos.
              </p>
              <Button onClick={() => setModalOpen(true)} size="lg" className="mt-8">
                Criar primeira conversa
              </Button>
            </Card>
          </motion.div>
        ) : filteredConversations.length === 0 && hasSearch ? (
          <p className="mt-16 text-center text-base normal-case text-muted-foreground">
            Nenhuma conversa encontrada para &lsquo;{searchQuery.trim()}&rsquo;
          </p>
        ) : filteredConversations.length === 0 ? (
          <p className="mt-16 text-center text-base normal-case text-muted-foreground">
            Nenhuma conversa com este filtro.
          </p>
        ) : (
          <>
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="mt-8 space-y-4"
            >
              {paginatedConversations.map((conversation) => (
                <motion.li key={conversation.id} variants={staggerItem}>
                  <ConversationCard conversation={conversation} />
                </motion.li>
              ))}
            </motion.ul>

            {showPagination && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-2 border-border bg-surface px-4 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                >
                  Anterior
                </Button>
                <span className="px-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                  Página {safePage} de {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <NewConversationModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ProfileSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

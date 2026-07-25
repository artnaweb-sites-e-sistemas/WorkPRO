import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ConversationCard } from '../components/ConversationCard'
import { ProposalCard } from '../components/ProposalCard'
import { NewConversationModal } from '../components/NewConversationModal'
import { ProfileSettingsModal } from '../components/ProfileSettingsModal'
import { useAuth } from '../context/AuthContext'
import { listConversations } from '../services/conversations'
import { listProposals } from '../services/proposals'
import type { Conversation, ConversationStatus, Stage } from '../types/models'
import type { ProposalDoc, ProposalStatus } from '../types/proposalDoc'
import { matchesConversationSearch, matchesProposalSearch } from '../lib/search'
import { staggerContainer, staggerItem } from '../lib/motion'
import { cn } from '../lib/cn'
import { Button, Card, Spinner } from '../components/ui'

type StatusFilter = ConversationStatus | 'todos'
type DashboardStageFilter = Exclude<Stage, 'videocall'>
type StageFilter = DashboardStageFilter | 'todos'
type HomeSection = 'conversas' | 'propostas'
type ProposalStatusFilter = ProposalStatus | 'todos'

const PAGE_SIZE = 5
const PROPOSAL_PAGE_SIZE = 5

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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, logout } = useAuth()
  const initialSection: HomeSection =
    searchParams.get('tab') === 'propostas' ? 'propostas' : 'conversas'
  const [homeSection, setHomeSection] = useState<HomeSection>(initialSection)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [proposals, setProposals] = useState<ProposalDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [proposalsError, setProposalsError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [proposalStatusFilter, setProposalStatusFilter] =
    useState<ProposalStatusFilter>('todos')
  const [stageFilter, setStageFilter] = useState<StageFilter>('todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [proposalPage, setProposalPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, stageFilter, searchQuery])

  useEffect(() => {
    setProposalPage(1)
  }, [searchQuery, proposalStatusFilter])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'propostas' || tab === 'conversas') {
      setHomeSection(tab)
    }
  }, [searchParams])

  function handleHomeSectionChange(section: HomeSection) {
    setHomeSection(section)
    if (section === 'propostas') {
      setSearchParams({ tab: 'propostas' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  useEffect(() => {
    setProposalPage(1)
    setSearchQuery('')
    setProposalStatusFilter('todos')
  }, [homeSection])

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

  useEffect(() => {
    if (homeSection !== 'propostas') {
      return
    }

    let cancelled = false
    setProposalsLoading(true)
    setProposalsError(null)

    void listProposals()
      .then((items) => {
        if (cancelled) {
          return
        }
        setProposals(items)
      })
      .catch((error) => {
        console.error('[Dashboard] listProposals error:', error)
        if (!cancelled) {
          setProposalsError(error instanceof Error ? error.message : 'Erro ao carregar propostas')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProposalsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [homeSection])

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

  const filteredProposals = useMemo(() => {
    const byStatus =
      proposalStatusFilter === 'todos'
        ? proposals
        : proposals.filter((proposal) => proposal.status === proposalStatusFilter)

    if (!searchQuery.trim()) {
      return byStatus
    }

    return byStatus.filter((proposal) =>
      matchesProposalSearch(
        proposal.input.tagline || proposal.input.companyName,
        proposal.content.projectTitle,
        searchQuery,
      ),
    )
  }, [proposals, searchQuery, proposalStatusFilter])

  const proposalTotalPages = Math.max(1, Math.ceil(filteredProposals.length / PROPOSAL_PAGE_SIZE))
  const safeProposalPage = Math.min(proposalPage, proposalTotalPages)

  const paginatedProposals = useMemo(() => {
    const start = (safeProposalPage - 1) * PROPOSAL_PAGE_SIZE
    return filteredProposals.slice(start, start + PROPOSAL_PAGE_SIZE)
  }, [filteredProposals, safeProposalPage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (proposalPage > proposalTotalPages) {
      setProposalPage(proposalTotalPages)
    }
  }, [proposalPage, proposalTotalPages])

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todas' },
    { value: 'ativo', label: 'Ativas' },
    { value: 'fechado', label: 'Fechadas' },
    { value: 'perdido', label: 'Perdidas' },
  ]

  const proposalStatusTabs: { value: ProposalStatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todas' },
    { value: 'ativo', label: 'Ativas' },
    { value: 'fechado', label: 'Fechadas' },
    { value: 'perdido', label: 'Perdidas' },
  ]

  const hasSearch = searchQuery.trim().length > 0
  const isProposals = homeSection === 'propostas'
  const leadCountDisplay = String(
    isProposals ? proposals.length : conversations.length,
  ).padStart(2, '0')
  const showPagination = filteredConversations.length > PAGE_SIZE
  const showProposalPagination = filteredProposals.length > PROPOSAL_PAGE_SIZE

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
        <div className="relative z-10 mb-6 flex flex-wrap gap-2">
          {(
            [
              { value: 'conversas' as const, label: 'Conversas' },
              { value: 'propostas' as const, label: 'Propostas' },
            ] as const
          ).map((section) => (
            <button
              key={section.value}
              type="button"
              onClick={() => handleHomeSectionChange(section.value)}
              className={cn(
                'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors duration-150',
                homeSection === section.value
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-transparent text-muted-foreground hover:text-accent',
              )}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 top-0 select-none font-bold leading-none text-muted text-[6rem] sm:text-[8rem]"
          >
            {leadCountDisplay}
          </span>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold uppercase tracking-tighter text-foreground">
              {isProposals ? 'Propostas' : 'Conversas'}
            </h2>
            <p className="mt-2 text-base normal-case text-muted-foreground">
              {isProposals
                ? `${proposals.length} proposta${proposals.length !== 1 ? 's' : ''} no total`
                : `${conversations.length} lead${conversations.length !== 1 ? 's' : ''} no total`}
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-3">
            {isProposals ? (
              <Button size="lg" onClick={() => navigate('/proposta')}>
                + Nova proposta
              </Button>
            ) : (
              <Button onClick={() => setModalOpen(true)} size="lg">
                + Nova conversa
              </Button>
            )}
          </div>
        </div>

        {!isProposals && conversations.length > 0 && (
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

        {isProposals && proposals.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {proposalStatusTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setProposalStatusFilter(tab.value)}
                  className={cn(
                    'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors duration-150',
                    proposalStatusFilter === tab.value
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border bg-transparent text-muted-foreground hover:text-accent',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative mt-5">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por empresa ou título..."
                className="min-h-touch w-full border-2 border-border bg-surface-2 py-3 pl-10 pr-4 text-sm normal-case text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </>
        )}

        {isProposals ? (
          proposalsLoading ? (
            <div className="mt-16 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : proposalsError ? (
            <p className="mt-16 border-2 border-status-error px-4 py-3 text-base normal-case text-status-error">
              Erro ao carregar propostas: {proposalsError}
            </p>
          ) : proposals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mt-16"
            >
              <Card padding="lg" className="relative z-10 text-center">
                <h3 className="text-2xl font-bold uppercase tracking-tighter text-foreground">
                  Nenhuma proposta ainda
                </h3>
                <p className="mx-auto mt-4 max-w-md text-base normal-case leading-relaxed text-muted-foreground">
                  Monte uma proposta comercial em PDF com o seu template e salve para reabrir
                  depois.
                </p>
                <Button size="lg" className="mt-8" onClick={() => navigate('/proposta')}>
                  Criar primeira proposta
                </Button>
              </Card>
            </motion.div>
          ) : filteredProposals.length === 0 && hasSearch ? (
            <p className="mt-16 text-center text-base normal-case text-muted-foreground">
              Nenhuma proposta encontrada para &lsquo;{searchQuery.trim()}&rsquo;
            </p>
          ) : filteredProposals.length === 0 ? (
            <p className="mt-16 text-center text-base normal-case text-muted-foreground">
              Nenhuma proposta com este filtro.
            </p>
          ) : (
            <>
              <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="mt-8 space-y-4"
              >
                {paginatedProposals.map((proposal) => (
                  <motion.li key={proposal.id} variants={staggerItem}>
                    <ProposalCard proposal={proposal} />
                  </motion.li>
                ))}
              </motion.ul>

              {showProposalPagination && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-2 border-border bg-surface px-4 py-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setProposalPage((page) => Math.max(1, page - 1))}
                    disabled={safeProposalPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-2 text-xs font-bold uppercase tracking-tight text-muted-foreground">
                    Página {safeProposalPage} de {proposalTotalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setProposalPage((page) => Math.min(proposalTotalPages, page + 1))
                    }
                    disabled={safeProposalPage >= proposalTotalPages}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )
        ) : loading ? (
          <div className="mt-16 flex justify-center">
            <Spinner size="lg" />
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

import { Button, Input, Switch, Textarea } from './ui'
import { ProposalExtrasFields } from './ProposalExtrasFields'
import type { ExtraDraft } from './ProposalExtrasFields'
import type { ProposalAiContent, ProposalPageBreaks, ProposalSectionId } from '../types/proposalDoc'

interface ProposalContentEditorProps {
  value: ProposalAiContent
  onChange: (next: ProposalAiContent) => void
  pageBreaks: ProposalPageBreaks
  onPageBreaksChange: (next: ProposalPageBreaks) => void
  /** quando presente, renderiza a lista de adicionais dentro do editor */
  extras?: {
    items: ExtraDraft[]
    onChange: (items: ExtraDraft[]) => void
    aiSuggest: boolean
    onAiSuggestChange: (value: boolean) => void
  }
}

function SectionBreakSwitch({
  section,
  pageBreaks,
  onPageBreaksChange,
}: {
  section: ProposalSectionId
  pageBreaks: ProposalPageBreaks
  onPageBreaksChange: (next: ProposalPageBreaks) => void
}) {
  return (
    <Switch
      id={`page-break-${section}`}
      label="Quebrar página"
      labelPosition="before"
      checked={pageBreaks[section] === true}
      onChange={(checked) =>
        onPageBreaksChange({
          ...pageBreaks,
          [section]: checked,
        })
      }
    />
  )
}

export function ProposalContentEditor({
  value,
  onChange,
  pageBreaks,
  onPageBreaksChange,
  extras,
}: ProposalContentEditorProps) {
  function patch(partial: Partial<ProposalAiContent>) {
    onChange({ ...value, ...partial })
  }

  function updateHowItWorks(
    index: number,
    partial: Partial<ProposalAiContent['howItWorks'][number]>,
  ) {
    patch({
      howItWorks: value.howItWorks.map((item, i) =>
        i === index ? { ...item, ...partial } : item,
      ),
    })
  }

  function removeHowItWorks(index: number) {
    patch({ howItWorks: value.howItWorks.filter((_, i) => i !== index) })
  }

  function addHowItWorks() {
    patch({
      howItWorks: [...value.howItWorks, { stage: '', description: '' }],
    })
  }

  function updateProjectStep(index: number, text: string) {
    patch({
      projectSteps: value.projectSteps.map((step, i) => (i === index ? text : step)),
    })
  }

  function removeProjectStep(index: number) {
    patch({ projectSteps: value.projectSteps.filter((_, i) => i !== index) })
  }

  function addProjectStep() {
    patch({ projectSteps: [...value.projectSteps, ''] })
  }

  function updateIncludedItem(index: number, text: string) {
    patch({
      includedItems: value.includedItems.map((item, i) => (i === index ? text : item)),
    })
  }

  function removeIncludedItem(index: number) {
    patch({ includedItems: value.includedItems.filter((_, i) => i !== index) })
  }

  function addIncludedItem() {
    patch({ includedItems: [...value.includedItems, ''] })
  }

  const breakSwitch = (section: ProposalSectionId) => (
    <SectionBreakSwitch
      section={section}
      pageBreaks={pageBreaks}
      onPageBreaksChange={onPageBreaksChange}
    />
  )

  return (
    <div className="space-y-6 border-2 border-border bg-surface p-5 sm:p-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Editar textos da proposta</p>
        <p className="mt-1 text-xs normal-case text-muted-foreground">
          Ajuste o que a IA gerou. Quebrar página manda aquela seção para a próxima folha do
          PDF. Ao desligar o switch Editar, o PDF atualiza.
        </p>
      </div>

      <Input
        label="Título do projeto"
        value={value.projectTitle}
        onChange={(event) => patch({ projectTitle: event.target.value })}
      />

      <Input
        label="Subtítulo"
        value={value.projectSubtitle}
        onChange={(event) => patch({ projectSubtitle: event.target.value })}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kinetic-label">Sobre o projeto</p>
          {breakSwitch('about')}
        </div>
        <Textarea
          aria-label="Sobre o projeto"
          value={value.aboutText}
          onChange={(event) => patch({ aboutText: event.target.value })}
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="kinetic-label">Itens inclusos</p>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {value.includedItems.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={addIncludedItem}>
              + Item
            </Button>
            {breakSwitch('included')}
          </div>
        </div>

        {value.includedItems.length === 0 ? (
          <p className="text-xs normal-case text-muted-foreground">Nenhum item incluso ainda.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {value.includedItems.map((item, index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={item}
                  onChange={(event) => updateIncludedItem(index, event.target.value)}
                  placeholder="Descreva o item incluso"
                  aria-label={`Item incluso ${index + 1}`}
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeIncludedItem(index)}
                  aria-label={`Remover item incluso ${index + 1}`}
                  title="Remover item"
                  className="min-h-touch min-w-touch shrink-0 text-muted-foreground transition-colors duration-150 hover:text-status-error"
                >
                  <svg
                    className="mx-auto h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kinetic-label">Pré-requisitos</p>
          {breakSwitch('prerequisite')}
        </div>
        <Textarea
          aria-label="Pré-requisitos"
          value={value.prerequisiteBody ?? ''}
          onChange={(event) =>
            patch({
              prerequisiteBody: event.target.value.trim() ? event.target.value : null,
            })
          }
          rows={4}
          hint="Um pré-requisito por linha. Deixe vazio se não houver."
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kinetic-label">Como funciona</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={addHowItWorks}>
              Adicionar etapa
            </Button>
            {breakSwitch('howItWorks')}
          </div>
        </div>
        {value.howItWorks.length === 0 ? (
          <p className="text-xs normal-case text-muted-foreground">Nenhuma etapa ainda.</p>
        ) : (
          <ul className="space-y-4">
            {value.howItWorks.map((item, index) => (
              <li key={index} className="space-y-3 border-2 border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                    Etapa {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeHowItWorks(index)}
                  >
                    Remover
                  </Button>
                </div>
                <Input
                  label="Nome da etapa"
                  value={item.stage}
                  onChange={(event) => updateHowItWorks(index, { stage: event.target.value })}
                />
                <Textarea
                  label="Descrição"
                  value={item.description}
                  onChange={(event) =>
                    updateHowItWorks(index, { description: event.target.value })
                  }
                  rows={3}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kinetic-label">Investimento</p>
          {breakSwitch('investment')}
        </div>
        <Input
          label="Rótulo do investimento (setup)"
          value={value.setupLabel}
          onChange={(event) => patch({ setupLabel: event.target.value })}
        />
      </div>

      {extras ? (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="kinetic-label">Adicionais</p>
            {breakSwitch('extras')}
          </div>
          <ProposalExtrasFields {...extras} />
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="kinetic-label">Passos do projeto</p>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {value.projectSteps.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={addProjectStep}>
              Adicionar passo
            </Button>
            {breakSwitch('nextSteps')}
          </div>
        </div>

        {value.projectSteps.length === 0 ? (
          <p className="text-xs normal-case text-muted-foreground">
            Nenhum passo ainda. Só os passos de pagamento vão aparecer no PDF.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {value.projectSteps.map((step, index) => (
              <li key={index} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={step}
                  onChange={(event) => updateProjectStep(index, event.target.value)}
                  placeholder="Descreva o passo"
                  aria-label={`Passo ${index + 1}`}
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeProjectStep(index)}
                  aria-label={`Remover passo ${index + 1}`}
                  title="Remover passo"
                  className="min-h-touch min-w-touch shrink-0 text-muted-foreground transition-colors duration-150 hover:text-status-error"
                >
                  <svg
                    className="mx-auto h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs normal-case text-muted-foreground">
          Só os passos de execução. O pagamento e a recorrência entram sozinhos na
          numeração do PDF.
        </p>
      </div>

      <Textarea
        label="Texto de encerramento"
        value={value.closingParagraph}
        onChange={(event) => patch({ closingParagraph: event.target.value })}
        rows={4}
      />
    </div>
  )
}

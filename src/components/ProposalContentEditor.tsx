import { Button, Input, Textarea } from './ui'
import type { ProposalAiContent } from '../types/proposalDoc'

interface ProposalContentEditorProps {
  value: ProposalAiContent
  onChange: (next: ProposalAiContent) => void
  showRecurringLabel: boolean
}

export function ProposalContentEditor({
  value,
  onChange,
  showRecurringLabel,
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

  return (
    <div className="space-y-6 border-2 border-border bg-surface p-5 sm:p-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Editar textos da proposta</p>
        <p className="mt-1 text-xs normal-case text-muted-foreground">
          Ajuste o que a IA gerou. Ao desligar o switch, o PDF atualiza com essas alterações.
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

      <Textarea
        label="Sobre o projeto"
        value={value.aboutText}
        onChange={(event) => patch({ aboutText: event.target.value })}
        rows={5}
      />

      <Textarea
        label="Itens inclusos"
        value={value.includedItems.join('\n')}
        onChange={(event) =>
          patch({
            includedItems: event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
        rows={6}
        hint="Um item por linha."
      />

      <Textarea
        label="Pré-requisitos"
        value={value.prerequisiteBody ?? ''}
        onChange={(event) =>
          patch({
            prerequisiteBody: event.target.value.trim() ? event.target.value : null,
          })
        }
        rows={4}
        hint="Um pré-requisito por linha. Deixe vazio se não houver."
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="kinetic-label">Como funciona</p>
          <Button type="button" variant="secondary" size="sm" onClick={addHowItWorks}>
            Adicionar etapa
          </Button>
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

      <Input
        label="Rótulo do investimento (setup)"
        value={value.setupLabel}
        onChange={(event) => patch({ setupLabel: event.target.value })}
      />

      {showRecurringLabel ? (
        <Input
          label="Rótulo da recorrência"
          value={value.recurringLabel}
          onChange={(event) => patch({ recurringLabel: event.target.value })}
        />
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="kinetic-label">Passos do projeto</p>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {value.projectSteps.length}
            </span>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addProjectStep}>
            Adicionar passo
          </Button>
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

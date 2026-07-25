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

      <Textarea
        label="Passos do projeto"
        value={value.projectSteps.join('\n')}
        onChange={(event) =>
          patch({
            projectSteps: event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          })
        }
        rows={4}
        hint="Um passo por linha (2 a 3). Pagamentos são montados automaticamente."
      />

      <Textarea
        label="Texto de encerramento"
        value={value.closingParagraph}
        onChange={(event) => patch({ closingParagraph: event.target.value })}
        rows={4}
      />
    </div>
  )
}

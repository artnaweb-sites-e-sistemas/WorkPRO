import { useState } from 'react'
import { parseConversationImport, type ReconcileAction } from '../ai/importParser'
import { useConfirm } from '../context/ConfirmContext'
import { isTaggedConversationImport, parseTaggedConversationImport } from '../lib/parseTaggedConversation'
import { addMessage, applyReconciledThread } from '../services/messages'
import type { Conversation, Message, Sender } from '../types/models'
import { cn } from '../lib/cn'
import { Button, Dialog, Textarea } from './ui'

type InputMode = 'reply' | 'import'

interface ImportPreviewItem {
  id: string
  sender: Sender
  text: string
  action: ReconcileAction
  matchedMessageId: string | null
  previousText?: string
  selected: boolean
  timeLabel?: string | null
  createdAt?: Date
}

const ACTION_LABELS: Record<ReconcileAction, string> = {
  kept: 'mantida',
  updated: 'atualizada',
  added: 'nova',
}

const ACTION_STYLES: Record<ReconcileAction, string> = {
  kept: 'border-border bg-muted text-muted-foreground',
  updated: 'border-status-warning bg-status-warning/10 text-foreground',
  added: 'border-accent bg-accent/10 text-foreground',
}

interface ImportConversationPanelProps {
  conversationId: string
  conversation: Conversation
  messages: Message[]
}

export function ImportConversationPanel({
  conversationId,
  conversation,
  messages,
}: ImportConversationPanelProps) {
  const [inputMode, setInputMode] = useState<InputMode>('reply')
  const [clientReply, setClientReply] = useState('')
  const [importText, setImportText] = useState('')
  const [savingClientReply, setSavingClientReply] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([])
  const confirm = useConfirm()

  async function handleSaveClientReply() {
    if (!clientReply.trim()) {
      return
    }

    setSavingClientReply(true)
    setError('')

    try {
      await addMessage(conversationId, {
        sender: 'cliente',
        stage: conversation.stage,
        text: clientReply.trim(),
      })
      setClientReply('')
    } catch {
      setError('Erro ao salvar resposta do cliente.')
    } finally {
      setSavingClientReply(false)
    }
  }

  const isTaggedImport = isTaggedConversationImport(importText)

  async function handleAnalyzeImport() {
    if (!importText.trim()) {
      return
    }

    setAnalyzing(true)
    setError('')

    try {
      const parsed = isTaggedImport
        ? parseTaggedConversationImport(importText, messages)
        : await parseConversationImport(importText, conversation.clientName, messages)
      const existingById = new Map(messages.map((message) => [message.id, message]))

      setPreviewItems(
        parsed.map((item, index) => ({
          id: item.matchedMessageId ?? `import-${index}-${item.text.slice(0, 24)}`,
          sender: item.sender,
          text: item.text,
          action: item.action,
          matchedMessageId: item.matchedMessageId,
          previousText:
            item.action === 'updated' && item.matchedMessageId
              ? existingById.get(item.matchedMessageId)?.text
              : undefined,
          selected: true,
          timeLabel: item.timeLabel,
          createdAt: item.createdAt,
        })),
      )
      setPreviewOpen(true)
    } catch {
      setError('Não foi possível analisar a conversa. Tente novamente.')
    } finally {
      setAnalyzing(false)
    }
  }

  function togglePreviewSender(id: string) {
    setPreviewItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, sender: item.sender === 'eu' ? 'cliente' : 'eu' }
          : item,
      ),
    )
  }

  function togglePreviewSelected(id: string) {
    setPreviewItems((items) =>
      items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  async function handleConfirmSync() {
    const toSync = previewItems.filter((item) => item.selected)

    if (toSync.length === 0) {
      return
    }

    const confirmed = await confirm({
      title: 'Sincronizar conversa',
      message: 'Isso vai sincronizar a conversa com a Workana. Deseja continuar?',
      confirmLabel: 'Sincronizar',
    })

    if (!confirmed) {
      return
    }

    setSyncing(true)
    setError('')

    try {
      await applyReconciledThread(
        conversationId,
        conversation.stage,
        toSync.map((item) => ({
          sender: item.sender,
          text: item.text,
          action: item.action,
          matchedMessageId: item.matchedMessageId,
          createdAt: item.createdAt,
        })),
      )

      setPreviewOpen(false)
      setPreviewItems([])
      setImportText('')
      setInputMode('reply')
    } catch (err) {
      console.error('[ImportConversationPanel] applyReconciledThread error:', err)
      setError('Erro ao sincronizar conversa.')
    } finally {
      setSyncing(false)
    }
  }

  const selectedCount = previewItems.filter((item) => item.selected).length

  return (
    <>
      <div className="space-y-4 border border-border bg-surface p-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setInputMode('reply')}
            className={cn(
              'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors',
              inputMode === 'reply'
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Resposta do cliente
          </button>
          <button
            type="button"
            onClick={() => setInputMode('import')}
            className={cn(
              'min-h-touch border-2 px-4 py-2 text-xs font-bold uppercase tracking-tight transition-colors',
              inputMode === 'import'
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            Importar conversa
          </button>
        </div>

        {inputMode === 'reply' ? (
          <>
            <Textarea
              label="Resposta do cliente"
              rows={4}
              value={clientReply}
              onChange={(event) => setClientReply(event.target.value)}
              placeholder="Cole aqui o que o cliente respondeu na Workana..."
              className="text-base leading-relaxed"
            />
            <Button
              variant="secondary"
              onClick={handleSaveClientReply}
              disabled={!clientReply.trim()}
              loading={savingClientReply}
            >
              Salvar resposta do cliente
            </Button>
          </>
        ) : (
          <>
            <Textarea
              id="conversa-da-workana"
              label="Conversa da Workana"
              rows={8}
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Cole aqui a conversa inteira copiada da Workana..."
              hint={
                isTaggedImport
                  ? 'Formato com #eu / #cliente detectado — importação direta, sem IA. Use #remetente (há 2 dias): antes de cada mensagem.'
                  : 'Cole a conversa na ordem da Workana. O sistema usa as mensagens já cadastradas para classificar remetentes e reconciliar o histórico.'
              }
              className="min-h-[200px] text-base leading-relaxed"
            />
            <Button
              variant="secondary"
              onClick={handleAnalyzeImport}
              disabled={!importText.trim()}
              loading={analyzing}
            >
              {analyzing
                ? isTaggedImport
                  ? 'Importando...'
                  : 'Analisando...'
                : isTaggedImport
                  ? 'Importar conversa'
                  : 'Analisar conversa'}
            </Button>
          </>
        )}

        {error && (
          <p className="border border-status-error px-3 py-2 text-sm normal-case text-status-error">
            {error}
          </p>
        )}
      </div>

      <Dialog
        open={previewOpen}
        onClose={() => !syncing && setPreviewOpen(false)}
        title="Sincronizar conversa"
        description="Confira a ordem, remetente e ação de cada mensagem antes de sincronizar."
        className="max-w-2xl"
        footer={
          previewItems.length > 0 ? (
            <>
              <Button variant="ghost" onClick={() => setPreviewOpen(false)} disabled={syncing}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSync}
                loading={syncing}
                disabled={selectedCount === 0}
              >
                Sincronizar conversa ({selectedCount})
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          )
        }
      >
        <p className="mb-4 border-2 border-status-warning bg-status-warning/10 px-4 py-3 text-sm normal-case text-foreground">
          Isso vai sincronizar a conversa com a Workana: atualiza mensagens enviadas parcialmente,
          mantém as que você não enviou e adiciona as novas.
        </p>

        {previewItems.length === 0 ? (
          <p className="text-sm normal-case text-muted-foreground">
            Nenhuma mensagem encontrada no texto colado.
          </p>
        ) : (
          <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
            {previewItems.map((item, index) => (
              <li key={`${item.id}-${index}`} className="border border-border bg-surface-2 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span
                    className={cn(
                      'border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      ACTION_STYLES[item.action],
                    )}
                  >
                    {ACTION_LABELS[item.action]}
                  </span>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => togglePreviewSelected(item.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Incluir
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => togglePreviewSender(item.id)}
                    className={cn(
                      'border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                      item.sender === 'eu'
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {item.sender === 'eu' ? 'Eu' : 'Cliente'}
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    clique para alternar
                  </span>
                  {item.timeLabel && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {item.timeLabel}
                    </span>
                  )}
                </div>

                {item.action === 'updated' && item.previousText && (
                  <div className="mb-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Texto anterior (será aparado)
                    </p>
                    <p className="whitespace-pre-wrap text-sm normal-case leading-relaxed text-muted-foreground line-through">
                      {item.previousText}
                    </p>
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm normal-case leading-relaxed text-foreground">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  )
}

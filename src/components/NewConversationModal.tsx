import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createConversation } from '../services/conversations'
import { addImportedMessages } from '../services/messages'
import { subscribeServices } from '../services/services'
import {
  extractLeadNameFromTaggedText,
  isTaggedConversationImport,
  parseTaggedConversation,
} from '../lib/parseTaggedConversation'
import { parseProjectDetailsTags } from '../lib/parseProjectDetailsTags'
import type { ConversationChannel, ConversationServiceSnapshot, Service } from '../types/models'
import { ConversationServicePicker } from './ConversationServicePicker'
import { NewServiceModal } from './NewServiceModal'
import { ProposalChannelSelector } from './ProposalChannelSelector'
import { Button, Dialog, Input, Switch, Textarea } from './ui'

interface NewConversationModalProps {
  open: boolean
  onClose: () => void
}

const WHATSAPP_IMPORT_PLACEHOLDER = `#Eu: ...
#NomeDoLead: ...`

export function NewConversationModal({ open, onClose }: NewConversationModalProps) {
  const navigate = useNavigate()
  const workanaTextareaRef = useRef<HTMLTextAreaElement>(null)
  const clientNameInputRef = useRef<HTMLInputElement>(null)
  const parseOnPasteRef = useRef(false)
  const [channel, setChannel] = useState<ConversationChannel>('workana')
  const [availableServices, setAvailableServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [selectedServices, setSelectedServices] = useState<ConversationServiceSnapshot[]>([])
  const [projectDetails, setProjectDetails] = useState('')
  const [importContent, setImportContent] = useState('')
  const [clientName, setClientName] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [videoCallEnabled, setVideoCallEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [newServiceOpen, setNewServiceOpen] = useState(false)

  const isWhatsApp = channel === 'whatsapp'

  useEffect(() => {
    if (!open || !isWhatsApp) {
      return
    }

    setServicesLoading(true)

    const unsubscribe = subscribeServices(
      ({ list }) => {
        setAvailableServices(list)
        setServicesLoading(false)
      },
      () => {
        setServicesLoading(false)
      },
    )

    return unsubscribe
  }, [isWhatsApp, open])

  useEffect(() => {
    if (!open || isWhatsApp) {
      return
    }

    setTimeout(() => workanaTextareaRef.current?.focus(), 100)
  }, [isWhatsApp, open])

  function resetForm() {
    setChannel('workana')
    setSelectedServices([])
    setProjectDetails('')
    setImportContent('')
    setClientName('')
    setProjectTitle('')
    setVideoCallEnabled(false)
    setError('')
    setNewServiceOpen(false)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  function handleServiceCreated(service: Service) {
    const snapshot: ConversationServiceSnapshot = {
      name: service.name,
      description: service.description,
    }

    setSelectedServices((current) => {
      const alreadySelected = current.some(
        (selected) =>
          selected.name === snapshot.name && selected.description === snapshot.description,
      )
      return alreadySelected ? current : [...current, snapshot]
    })
  }

  function handleProjectDetailsChange(value: string, allowEndOfString = false) {
    const parsed = parseProjectDetailsTags(value, { allowEndOfString })

    setProjectDetails(parsed.projectDetails)

    if (parsed.projectTitle) {
      setProjectTitle(parsed.projectTitle)
    }

    if (parsed.clientName) {
      setClientName(parsed.clientName)
    }
  }

  function handleProjectDetailsInput(value: string) {
    if (parseOnPasteRef.current) {
      parseOnPasteRef.current = false
      handleProjectDetailsChange(value, true)
      return
    }

    handleProjectDetailsChange(value, false)
  }

  function handleProjectDetailsPaste(_event: ClipboardEvent<HTMLTextAreaElement>) {
    parseOnPasteRef.current = true
  }

  function applyWhatsAppImportParsing(value: string) {
    setImportContent(value)

    if (isTaggedConversationImport(value)) {
      const leadIdentifier = extractLeadNameFromTaggedText(value)

      if (leadIdentifier) {
        setClientName(leadIdentifier)
      }
    }
  }

  function handleImportContentInput(value: string) {
    if (parseOnPasteRef.current) {
      parseOnPasteRef.current = false
    }

    applyWhatsAppImportParsing(value)
  }

  function handleImportContentPaste(_event: ClipboardEvent<HTMLTextAreaElement>) {
    parseOnPasteRef.current = true
  }

  async function handleCreateWorkana() {
    const trimmedDetails = projectDetails.trim()

    if (!trimmedDetails) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const id = await createConversation({
        clientName: clientName.trim(),
        projectTitle: projectTitle.trim(),
        projectDetails: trimmedDetails,
        videoCallEnabled,
        channel: 'workana',
        services: [],
      })

      handleClose()
      navigate(`/conversa/${id}`, { state: { autoGenerate: true } })
    } catch (err) {
      console.error('[NewConversationModal] createConversation error:', err)
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Não foi possível criar a conversa: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateWhatsApp() {
    const trimmedName = clientName.trim()

    if (!trimmedName) {
      setError('Informe o nome do lead para continuar.')
      clientNameInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    setError('')

    const trimmedContext = projectDetails.trim()
    const trimmedImport = importContent.trim()
    const isTaggedImport = Boolean(trimmedImport && isTaggedConversationImport(trimmedImport))
    const parsedMessages = isTaggedImport ? parseTaggedConversation(trimmedImport) : []
    const shouldImportConversation = parsedMessages.length > 0
    // Contexto dedicado tem prioridade; se a pessoa colou texto livre no import (sem tags), usa como fallback.
    const finalProjectDetails =
      trimmedContext || (!isTaggedImport && trimmedImport ? trimmedImport : '')

    try {
      const id = await createConversation({
        clientName: trimmedName,
        projectTitle: '',
        projectDetails: finalProjectDetails,
        videoCallEnabled,
        channel: 'whatsapp',
        services: selectedServices,
        stage: shouldImportConversation ? 'relacionamento' : 'abordagem',
      })

      if (shouldImportConversation) {
        await addImportedMessages(id, 'relacionamento', parsedMessages)
      }

      handleClose()

      if (shouldImportConversation) {
        navigate(`/conversa/${id}`)
      } else {
        navigate(`/conversa/${id}`, { state: { autoGenerate: true } })
      }
    } catch (err) {
      console.error('[NewConversationModal] createConversation error:', err)
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Não foi possível criar a conversa: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreate() {
    if (isWhatsApp) {
      await handleCreateWhatsApp()
      return
    }

    await handleCreateWorkana()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void handleCreate()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault()
      void handleCreate()
    }
  }

  const hasProjectText = projectDetails.trim().length > 0
  const hasWhatsAppLeadName = clientName.trim().length > 0
  const canSubmitWorkana = hasProjectText
  const canSubmitWhatsApp = !servicesLoading && hasWhatsAppLeadName
  const canSubmit = isWhatsApp ? canSubmitWhatsApp : canSubmitWorkana

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Nova conversa"
      description={
        isWhatsApp
          ? 'Serviços, contexto e importação opcional.'
          : 'Cole o projeto da Workana e preencha os dados para começar.'
      }
      className="max-w-xl"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ProposalChannelSelector
              value={channel}
              onChange={setChannel}
              disabled={submitting}
              ariaLabel="Canal da conversa"
            />
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
          </div>
          <Button
            type="submit"
            form="new-conversation-form"
            size="sm"
            loading={submitting}
            disabled={!canSubmit}
          >
            {submitting ? 'Criando...' : 'Analisar e continuar'}
          </Button>
        </div>
      }
    >
      <form
        id="new-conversation-form"
        onSubmit={handleSubmit}
        className="space-y-5"
        autoComplete="off"
      >
        {isWhatsApp ? (
          <>
            <ConversationServicePicker
              availableServices={availableServices}
              selectedServices={selectedServices}
              onChange={setSelectedServices}
              loading={servicesLoading}
              disabled={submitting}
              onAddNew={() => setNewServiceOpen(true)}
            />

            <Textarea
              label="Contexto com o lead"
              rows={4}
              autoComplete="off"
              value={projectDetails}
              onChange={(event) => setProjectDetails(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="O que já foi combinado ou pedido..."
              hint="Opcional — a IA usa como contexto."
              className="min-h-[100px] text-base leading-relaxed"
            />

            <Textarea
              label="Importar conversa"
              rows={4}
              autoComplete="off"
              value={importContent}
              onChange={(event) => handleImportContentInput(event.target.value)}
              onPaste={handleImportContentPaste}
              onKeyDown={handleKeyDown}
              placeholder={WHATSAPP_IMPORT_PLACEHOLDER}
              hint="Opcional — formato #Eu / #NomeDoLead."
              className="min-h-[100px] text-base leading-relaxed"
            />

            <div className="space-y-4 border-2 border-border bg-surface-2 p-4">
              <Input
                ref={clientNameInputRef}
                id="workpro-lead-name-field-whatsapp"
                name="workpro-field-lead"
                autoComplete="off"
                label="Nome do lead"
                value={clientName}
                onChange={(event) => {
                  setClientName(event.target.value)
                  if (error) {
                    setError('')
                  }
                }}
                placeholder="Nome ou telefone"
                error={!hasWhatsAppLeadName && error ? 'Informe o nome do lead.' : undefined}
              />
            </div>
          </>
        ) : (
          <>
            <Textarea
              ref={workanaTextareaRef}
              label="Cole aqui o projeto da Workana"
              rows={6}
              required
              autoFocus
              autoComplete="off"
              value={projectDetails}
              onChange={(event) => handleProjectDetailsInput(event.target.value)}
              onPaste={handleProjectDetailsPaste}
              onKeyDown={handleKeyDown}
              placeholder="Cole a descrição completa do projeto, proposta ou mensagem do cliente..."
              hint="Ctrl+Enter para continuar"
              className="min-h-[140px] text-base leading-relaxed"
            />

            {hasProjectText && (
              <div className="space-y-4 border-2 border-border bg-surface-2 p-4">
                <Input
                  id="workpro-project-title-field"
                  name="workpro-field-projeto"
                  autoComplete="off"
                  readOnly
                  data-lpignore="true"
                  data-1p-ignore
                  label="Título do projeto"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  onFocus={(event) => event.currentTarget.removeAttribute('readonly')}
                  placeholder="Ex: Site institucional (opcional)"
                />

                <Input
                  id="workpro-lead-name-field"
                  name="workpro-field-lead"
                  autoComplete="off"
                  readOnly
                  data-lpignore="true"
                  data-1p-ignore
                  label="Nome do lead"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  onFocus={(event) => event.currentTarget.removeAttribute('readonly')}
                  placeholder="Ex: João (opcional)"
                />

                {!clientName.trim() && (
                  <p className="text-xs normal-case text-muted-foreground">
                    Sem problema, você pode adicionar o nome depois.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <Switch
          checked={videoCallEnabled}
          onChange={setVideoCallEnabled}
          label="Induzir vídeo chamada"
        />

        {error && (
          <p className="border-2 border-status-error px-3 py-2 text-sm normal-case text-status-error">
            {error}
          </p>
        )}
      </form>

      <NewServiceModal
        open={newServiceOpen}
        onClose={() => setNewServiceOpen(false)}
        onCreated={handleServiceCreated}
      />
    </Dialog>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { appendService, createService } from '../services/services'
import type { Service } from '../types/models'
import { Button, Dialog, Input, Textarea } from './ui'

interface NewServiceModalProps {
  open: boolean
  onClose: () => void
  onCreated: (service: Service) => void
}

const DESCRIPTION_PLACEHOLDER =
  'O que está incluso, pra quem serve, diferencial... a IA usa isso de contexto'

export function NewServiceModal({ open, onClose, onCreated }: NewServiceModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setName('')
    setDescription('')
    setError('')
    const timeout = setTimeout(() => nameInputRef.current?.focus(), 100)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timeout)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  async function handleSave() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Informe o nome do serviço.')
      nameInputRef.current?.focus()
      return
    }

    setSubmitting(true)
    setError('')

    const service = createService(trimmedName, description.trim())

    try {
      await appendService(service)
      onCreated(service)
      onClose()
    } catch (err) {
      console.error('[NewServiceModal] appendService error:', err)
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(`Não foi possível salvar o serviço: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void handleSave()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo serviço"
      description="Cadastre um serviço para usar como contexto nas conversas."
      className="max-w-md"
      overlayClassName="z-[60]"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-service-form"
            size="sm"
            loading={submitting}
            disabled={!name.trim()}
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <form id="new-service-form" onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        <Input
          ref={nameInputRef}
          id="workpro-new-service-name"
          autoComplete="off"
          label="Nome do serviço"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) {
              setError('')
            }
          }}
          placeholder="Ex: Landing page de alta conversão"
          error={error && !name.trim() ? 'Informe o nome do serviço.' : undefined}
        />

        <Textarea
          id="workpro-new-service-description"
          autoComplete="off"
          label="Descrição / contexto"
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDER}
          hint="A IA usa isso como contexto ao gerar mensagens."
          className="min-h-[120px] text-base leading-relaxed"
        />

        {error && name.trim() && (
          <p className="border-2 border-status-error px-3 py-2 text-sm normal-case text-status-error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

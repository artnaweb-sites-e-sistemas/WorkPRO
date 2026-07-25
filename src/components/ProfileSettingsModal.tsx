import { useEffect, useState } from 'react'
import { useConfirm } from '../context/ConfirmContext'
import { saveProfile, subscribeProfile } from '../services/profile'
import {
  addServiceToList,
  buildDefaultServicesFromAreas,
  removeServiceFromList,
  saveServices,
  subscribeServices,
  updateServiceInList,
} from '../services/services'
import type { PresenterProfile, Service } from '../types/models'
import { cn } from '../lib/cn'
import { Button, Dialog, Input, Switch, Textarea, Spinner } from './ui'

interface ProfileSettingsModalProps {
  open: boolean
  onClose: () => void
}

function RemoveServiceIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export function ProfileSettingsModal({ open, onClose }: ProfileSettingsModalProps) {
  const confirm = useConfirm()
  const [profile, setProfile] = useState<PresenterProfile | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [servicesSeeded, setServicesSeeded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setLoading(true)
    setError('')
    setServicesSeeded(false)

    let profileLoaded = false
    let servicesLoaded = false
    let latestProfile: PresenterProfile | null = null
    let latestServices: Service[] = []
    let servicesIsNewDocument = false

    function tryFinishLoading() {
      if (!profileLoaded || !servicesLoaded) {
        return
      }

      setProfile(latestProfile)

      if (servicesIsNewDocument && latestServices.length === 0 && latestProfile) {
        setServices(buildDefaultServicesFromAreas(latestProfile.areas))
        setServicesSeeded(true)
      } else {
        setServices(latestServices)
        setServicesSeeded(false)
      }

      setLoading(false)
    }

    const unsubscribeProfile = subscribeProfile(
      (data) => {
        latestProfile = data
        profileLoaded = true
        tryFinishLoading()
      },
      () => {
        setError('Erro ao carregar configurações.')
        setLoading(false)
      },
    )

    const unsubscribeServices = subscribeServices(
      ({ list, isNewDocument }) => {
        latestServices = list
        servicesIsNewDocument = isNewDocument
        servicesLoaded = true
        tryFinishLoading()
      },
      () => {
        setError('Erro ao carregar serviços.')
        setLoading(false)
      },
    )

    return () => {
      unsubscribeProfile()
      unsubscribeServices()
    }
  }, [open])

  function updateField<K extends keyof PresenterProfile>(key: K, value: PresenterProfile[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current))
  }

  function updateServiceField(id: string, partial: Partial<Omit<Service, 'id'>>) {
    setServices((current) => updateServiceInList(current, id, partial))
  }

  function handleAddService() {
    setServices((current) => addServiceToList(current))
  }

  async function handleRemoveService(id: string) {
    const service = services.find((item) => item.id === id)
    const confirmed = await confirm({
      title: 'Remover serviço',
      message: service?.name.trim()
        ? `Remover "${service.name.trim()}" da lista?`
        : 'Remover este serviço da lista?',
      confirmLabel: 'Remover',
      variant: 'danger',
    })

    if (!confirmed) {
      return
    }

    setServices((current) => removeServiceFromList(current, id))
  }

  async function handleSave() {
    if (!profile) {
      return
    }

    setSaving(true)
    setError('')

    try {
      await Promise.all([saveProfile(profile), saveServices(services)])
      setServicesSeeded(false)
      onClose()
    } catch {
      setError('Não foi possível salvar as configurações.')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    if (saving) {
      return
    }

    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Configurações"
      description="Apresentação base e serviços usados pela IA nas conversas."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void handleSave()} loading={saving} disabled={!profile}>
            Salvar
          </Button>
        </>
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <p className="mb-4 border border-status-error px-3 py-2 text-sm normal-case text-status-error">
          {error}
        </p>
      )}

      {!loading && profile && (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <p className="kinetic-label mb-1">Apresentação base</p>
              <p className="text-sm normal-case text-muted-foreground">
                Dados usados no roteiro de reunião.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                value={profile.nome}
                onChange={(event) => updateField('nome', event.target.value)}
              />
              <Input
                label="Empresa"
                value={profile.empresa}
                onChange={(event) => updateField('empresa', event.target.value)}
              />
              <Input
                label="Desde (ano)"
                value={profile.desde}
                onChange={(event) => updateField('desde', event.target.value)}
              />
            </div>

            <Textarea
              label="Áreas de atuação"
              rows={2}
              value={profile.areas}
              onChange={(event) => updateField('areas', event.target.value)}
              hint="Liste as áreas em que você atua (separadas por vírgula). O roteiro escolhe a que casa com cada projeto."
            />

            <Textarea
              label="Prova social"
              rows={2}
              value={profile.provaSocial}
              onChange={(event) => updateField('provaSocial', event.target.value)}
              hint="Use apenas informações reais e comprováveis."
            />

            <Input
              label="Tom"
              value={profile.tom}
              onChange={(event) => updateField('tom', event.target.value)}
            />

            <Switch
              label="Usa briefing próprio"
              checked={profile.temBriefing}
              onChange={(checked) => updateField('temBriefing', checked)}
            />

            {profile.temBriefing && (
              <Input
                label="Informações do briefing"
                value={profile.briefingInfo}
                onChange={(event) => updateField('briefingInfo', event.target.value)}
              />
            )}
          </section>

          <section className="space-y-4 border-t-2 border-border pt-6">
            <div>
              <p className="kinetic-label mb-1">Serviços que ofereço</p>
              <p className="text-sm normal-case text-muted-foreground">
                A IA usa nome e contexto de cada serviço ao gerar mensagens e propostas.
              </p>
            </div>

            {services.length === 0 ? (
              <div className="border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center">
                <p className="text-sm normal-case text-muted-foreground">
                  Nenhum serviço cadastrado ainda.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={handleAddService}
                >
                  + Adicionar serviço
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div
                    key={service.id}
                    className="relative border-2 border-border bg-surface-2 p-4"
                  >
                    <button
                      type="button"
                      onClick={() => void handleRemoveService(service.id)}
                      className={cn(
                        'absolute right-3 top-3 flex h-8 w-8 items-center justify-center',
                        'border-2 border-border text-muted-foreground transition-colors duration-150',
                        'hover:border-status-error hover:text-status-error',
                      )}
                      aria-label={`Remover serviço ${service.name.trim() || index + 1}`}
                    >
                      <RemoveServiceIcon />
                    </button>

                    <div className="space-y-3 pr-10">
                      <Input
                        label={`Serviço ${index + 1}`}
                        value={service.name}
                        onChange={(event) =>
                          updateServiceField(service.id, { name: event.target.value })
                        }
                        placeholder="Ex: Web design"
                      />
                      <Textarea
                        label="Descrição / contexto"
                        rows={3}
                        value={service.description}
                        onChange={(event) =>
                          updateServiceField(service.id, { description: event.target.value })
                        }
                        placeholder="O que está incluso, pra quem serve, diferencial... a IA usa isso de contexto."
                        className="min-h-0 resize-y"
                      />
                    </div>
                  </div>
                ))}

                <Button type="button" variant="secondary" size="sm" onClick={handleAddService}>
                  + Adicionar serviço
                </Button>
              </div>
            )}

            {servicesSeeded && (
              <p className="text-xs normal-case text-muted-foreground">
                Sugestões iniciais a partir das suas áreas de atuação — edite e clique em Salvar.
              </p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  )
}

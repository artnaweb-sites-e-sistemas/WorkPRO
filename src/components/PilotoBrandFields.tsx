import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { MarkAnchorGrid, MarkScaleSlider } from './MarkPlacementPicker'
import { Button, Input } from './ui'
import { fileToLogoDataUrl, fileToMarkDataUrl } from '../lib/logoImage'
import type { MarkAnchor } from '../types/proposalDoc'
import { normalizeAccentColor } from '../types/proposalDoc'

export interface PilotoBrand {
  companyName: string
  professionalName: string
  logoDataUrl: string
  markDataUrl: string
  markAnchor: MarkAnchor
  markScale: number
  websiteUrl: string
  accentColor: string
}

interface PilotoBrandFieldsProps {
  brand: PilotoBrand
  onChange: (partial: Partial<PilotoBrand>) => void
}

const IMAGE_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp'

/**
 * Dados fixos da marca. São os mesmos da página de proposta: mudar aqui muda lá também.
 * Logo clara (vai na capa escura); símbolo escuro (marca d'água das páginas claras).
 */
export function PilotoBrandFields({ brand, onChange }: PilotoBrandFieldsProps) {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const markInputRef = useRef<HTMLInputElement>(null)
  const [logoError, setLogoError] = useState('')
  const [markError, setMarkError] = useState('')
  const accent = normalizeAccentColor(brand.accentColor)

  async function handleImage(
    event: ChangeEvent<HTMLInputElement>,
    kind: 'logo' | 'mark',
  ) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    const setError = kind === 'logo' ? setLogoError : setMarkError
    setError('')
    try {
      const dataUrl = kind === 'logo' ? await fileToLogoDataUrl(file) : await fileToMarkDataUrl(file)
      onChange(kind === 'logo' ? { logoDataUrl: dataUrl } : { markDataUrl: dataUrl })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao processar a imagem.')
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="kinetic-label mb-2">Logo e cor</p>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-32 shrink-0 items-center justify-center bg-[#0B0B0B] px-2">
            {brand.logoDataUrl ? (
              <img src={brand.logoDataUrl} alt="Logo" className="max-h-10 max-w-full object-contain" />
            ) : (
              <span className="text-xs normal-case text-muted-foreground">Sem logo</span>
            )}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()}>
            {brand.logoDataUrl ? 'Trocar' : 'Enviar'}
          </Button>
          <label
            className="relative ml-auto h-11 w-11 shrink-0 cursor-pointer border-2 border-border"
            title="Cor de destaque"
            aria-label="Cor de destaque"
          >
            <span className="absolute inset-0" style={{ backgroundColor: accent }} aria-hidden />
            <input
              type="color"
              value={accent.toLowerCase()}
              onChange={(event) => onChange({ accentColor: normalizeAccentColor(event.target.value) })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="mt-2 text-xs normal-case text-muted-foreground">
          Logo clara: ela vai na capa e no fechamento, que são escuros.
        </p>
        <input
          ref={logoInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => void handleImage(event, 'logo')}
        />
        {logoError ? <p className="mt-2 text-xs normal-case text-status-error">{logoError}</p> : null}
      </div>

      <div>
        <p className="kinetic-label mb-2">Símbolo da marca</p>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-white p-2">
            {brand.markDataUrl ? (
              <img src={brand.markDataUrl} alt="Símbolo" className="max-h-full max-w-full object-contain" />
            ) : null}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => markInputRef.current?.click()}>
            {brand.markDataUrl ? 'Trocar' : 'Enviar'}
          </Button>
          {brand.markDataUrl ? (
            <div className="ml-auto">
              <MarkAnchorGrid anchor={brand.markAnchor} onChange={(markAnchor) => onChange({ markAnchor })} />
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-xs normal-case text-muted-foreground">
          Marca d&apos;água das páginas claras e assinatura do rodapé. A grade define a posição no PDF.
        </p>
        {brand.markDataUrl ? (
          <div className="mt-3">
            <MarkScaleSlider scale={brand.markScale} onChange={(markScale) => onChange({ markScale })} />
          </div>
        ) : null}
        <input
          ref={markInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(event) => void handleImage(event, 'mark')}
        />
        {markError ? <p className="mt-2 text-xs normal-case text-status-error">{markError}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Empresa"
          value={brand.companyName}
          onChange={(event) => onChange({ companyName: event.target.value })}
        />
        <Input
          label="Seu nome"
          value={brand.professionalName}
          onChange={(event) => onChange({ professionalName: event.target.value })}
        />
      </div>
      <Input
        label="Site"
        value={brand.websiteUrl}
        onChange={(event) => onChange({ websiteUrl: event.target.value })}
        placeholder="www.suaempresa.com.br"
      />
    </div>
  )
}

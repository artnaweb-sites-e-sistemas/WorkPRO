import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { accentForegroundColor } from '../../types/proposalDoc'
import type { PilotoInput } from '../../types/piloto'
import { PILOTO_ICONS } from '../../lib/pilotoIcons'
import type { PilotoIconName } from '../../lib/pilotoIcons'

/**
 * Sistema visual da apresentação. Palco fixo de 1280x720; todo tamanho é em px.
 * Páginas claras no miolo, capa e fechamento escuros (mesma lógica do PDF da proposta,
 * e o único jeito da logo clara aparecer).
 */
export const INK = '#0B0B0B'
export const BODY = '#3F3F46'
export const MUTED = '#71717A'
export const FAINT = '#A1A1AA'
export const RULE = '#E4E4E7'
export const SOFT = '#F4F4F5'

export function onAccent(accent: string): string {
  return accentForegroundColor(accent)
}

/** Moeda para slide: sem ",00" quando o valor é redondo (R$ 5.000), com centavos quando não é. */
export function brl(cents: number): string {
  const round = cents % 100 === 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: round ? 0 : 2,
    maximumFractionDigits: round ? 0 : 2,
  }).format(cents / 100)
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function monthYear(date = new Date()): string {
  const raw = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * true quando o PNG do símbolo tem fundo transparente. Só assim dá para usar a
 * silhueta branca dele sobre fundo escuro sem virar um retângulo.
 */
export function useTransparentImage(src: string): boolean {
  const [transparent, setTransparent] = useState(false)

  useEffect(() => {
    if (!src) {
      setTransparent(false)
      return
    }

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) {
        return
      }
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        if (!context) {
          return
        }
        context.drawImage(image, 0, 0)
        const corners = [
          context.getImageData(0, 0, 1, 1).data[3],
          context.getImageData(image.width - 1, 0, 1, 1).data[3],
          context.getImageData(0, image.height - 1, 1, 1).data[3],
          context.getImageData(image.width - 1, image.height - 1, 1, 1).data[3],
        ]
        setTransparent(corners.every((alpha) => alpha < 16))
      } catch {
        setTransparent(false)
      }
    }
    image.onerror = () => {
      if (!cancelled) {
        setTransparent(false)
      }
    }
    image.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return transparent
}

/** Marca-texto: faixa da cor de destaque atrás da metade de baixo do texto. Legível com qualquer cor. */
export function Highlight({ accent, children }: { accent: string; children: ReactNode }) {
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(transparent 58%, ${accent} 58%, ${accent} 92%, transparent 92%)`,
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
        padding: '0 3px',
        margin: '0 -3px',
      }}
    >
      {children}
    </span>
  )
}

/** Intensidade em barras (tipo sinal de celular): não depende da cor para ser lida. */
export function SignalBars({ level, color = INK }: { level: 1 | 2 | 3; color?: string }) {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className="w-[5px]"
          style={{ height: 6 + bar * 4, backgroundColor: bar <= level ? color : RULE }}
        />
      ))}
    </span>
  )
}

/** Barra vertical de destaque + rótulo curto — mesma assinatura das seções do PDF. */
export function Kicker({
  accent,
  children,
  tone = 'light',
}: {
  accent: string
  children: ReactNode
  tone?: 'light' | 'dark'
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-[20px] w-[5px] shrink-0" style={{ backgroundColor: accent }} aria-hidden />
      <span
        className="text-[15px] font-semibold"
        style={{ color: tone === 'dark' ? FAINT : INK }}
      >
        {children}
      </span>
    </div>
  )
}

interface LightSlideProps {
  input: PilotoInput
  accent: string
  index: number
  total: number
  kicker: string
  title: ReactNode
  children: ReactNode
  /** título menor quando o texto vem da IA e pode ter duas linhas */
  compactTitle?: boolean
}

/** Moldura das páginas claras: marca d'água, cabeçalho, corpo e rodapé. */
export function LightSlide({
  input,
  accent,
  index,
  total,
  kicker,
  title,
  children,
  compactTitle = false,
}: LightSlideProps) {
  const mark = input.markDataUrl
  const company = input.companyName.trim()
  const lead = input.leadCompanyName.trim()

  return (
    <div className="relative h-full w-full overflow-hidden bg-white" style={{ color: INK }}>
      {mark ? (
        <img
          src={mark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute select-none"
          style={{
            width: 460,
            right: -110,
            bottom: -120,
            opacity: 0.05,
            transform: 'rotate(-16deg)',
          }}
        />
      ) : null}

      <div className="relative flex h-full flex-col px-[72px] pb-[26px] pt-[50px]">
        <header className="shrink-0">
          <Kicker accent={accent}>{kicker}</Kicker>
          <h2
            className={
              compactTitle
                ? 'mt-4 max-w-[1000px] text-[34px] font-bold leading-[1.15] tracking-[-0.02em]'
                : 'mt-4 max-w-[1040px] text-[40px] font-bold leading-[1.1] tracking-[-0.025em]'
            }
          >
            {title}
          </h2>
        </header>

        <div className="mt-8 min-h-0 flex-1">{children}</div>

        <footer
          className="mt-5 flex shrink-0 items-center justify-between border-t pt-4 text-[13px] font-medium"
          style={{ borderColor: RULE, color: FAINT }}
        >
          <div className="flex items-center gap-2.5">
            {mark ? <img src={mark} alt="" aria-hidden className="h-[18px] w-auto" /> : null}
            <span>{company || 'Piloto 45'}</span>
          </div>
          <span className="tabular-nums">
            {lead ? `${lead} · ` : ''}
            {pad2(index + 1)} / {pad2(total)}
          </span>
        </footer>
      </div>
    </div>
  )
}

/** Fundo das páginas escuras: o mesmo gradiente da capa do PDF. */
export function DarkSlide({
  input,
  children,
}: {
  input: PilotoInput
  children: ReactNode
}) {
  const mark = input.markDataUrl
  const markIsTransparent = useTransparentImage(mark)

  return (
    <div
      className="relative h-full w-full overflow-hidden text-white"
      style={{ background: 'linear-gradient(180deg, #171717 0%, #000000 100%)' }}
    >
      {mark && markIsTransparent ? (
        <img
          src={mark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute select-none"
          style={{
            width: 640,
            right: -150,
            top: '50%',
            opacity: 0.07,
            filter: 'brightness(0) invert(1)',
            transform: 'translateY(-50%) rotate(-16deg)',
          }}
        />
      ) : null}
      <div className="relative h-full w-full">{children}</div>
    </div>
  )
}

export function BrandLogo({ input, height = 52 }: { input: PilotoInput; height?: number }) {
  if (input.logoDataUrl) {
    return (
      <img
        src={input.logoDataUrl}
        alt={input.companyName || 'Logo'}
        className="w-auto max-w-[320px] object-contain object-left"
        style={{ height }}
      />
    )
  }
  return (
    <span className="text-[26px] font-bold tracking-[-0.02em] text-white">
      {input.companyName.trim() || 'Piloto 45'}
    </span>
  )
}

export function CheckIcon({ size = 18, color = INK, style }: { size?: number; color?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={style}>
      <path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Ícones de traço simples, desenhados à mão para não depender de biblioteca. */
export function LineIcon({ name, size = 28, color = INK }: { name: 'search' | 'eye' | 'clock'; size?: number; color?: string }) {
  const common = {
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === 'search' ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" {...common} />
          <path d="M15.5 15.5 20.5 20.5" {...common} />
        </>
      ) : null}
      {name === 'eye' ? (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...common} />
          <circle cx="12" cy="12" r="3" {...common} />
          <path d="M4 20 20 4" {...common} />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <circle cx="12" cy="12" r="8.5" {...common} />
          <path d="M12 7.5V12l3 2" {...common} />
        </>
      ) : null}
    </svg>
  )
}

/** Ícone do Piloto 45 (marca ou genérico), na cor pedida. */
export function PilotoIcon({ name, size = 18, color = INK }: { name: PilotoIconName; size?: number; color?: string }) {
  const icon = PILOTO_ICONS[name]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {icon.fill?.map((d) => <path key={d} d={d} fill={color} />)}
      {icon.stroke?.map((d) => (
        <path key={d} d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** Ícone dentro de um quadrado suave: leitura rápida, sem competir com o texto. */
export function IconTile({ name, size = 40 }: { name: PilotoIconName; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, backgroundColor: SOFT, borderRadius: 10 }}
    >
      <PilotoIcon name={name} size={Math.round(size * 0.48)} />
    </span>
  )
}

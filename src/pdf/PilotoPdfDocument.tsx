import type { ReactElement, ReactNode } from 'react'
import { Circle, Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import {
  AD_BUDGET_NOTE,
  ASSETS_THAT_STAY,
  CHAT_HANDOFF,
  CLOSING_FALLBACK,
  COMPARISON_TAGLINE,
  CONTINUES_IF_YOU_WANT,
  FOUNDATION_GROUPS,
  FUNNEL_STAGES,
  LEAKS,
  MILESTONES,
  NEXT_STEPS,
  PHASES,
  PILOT_GOAL,
  QUALIFICATION_COPY,
  RECURRENCE_NOTE,
  REPORT_METRICS,
  TEMPERATURE_LANES,
  trafficItems,
  TRAFFIC_LOOP,
  VIDEOS_NOTE,
  pilotoPromise,
  resolveChat,
} from '../lib/pilotoContent'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import { PILOTO_ICONS } from '../lib/pilotoIcons'
import type { PilotoIconName } from '../lib/pilotoIcons'
import {
  calcInstallments,
  continuationFromCents,
  getContinuationPlans,
  getPilotoPlans,
  channelLabel,
} from '../lib/pilotoPricing'
import type { ContinuationPlan, PilotoPlan, PilotoPricing } from '../lib/pilotoPricing'
import type { PilotoAiContent, PilotoInput, SituationAnswer } from '../types/piloto'
import {
  accentColorRgbChannels,
  accentForegroundColor,
  normalizeAccentColor,
} from '../types/proposalDoc'
import {
  CONTENT_W,
  CheckIcon,
  CoverLogo,
  DarkBackground,
  PAGE_H,
  PAGE_W,
  PageFooter,
  SectionHeading,
  Watermark,
  proposalPdfStyles as P,
} from './ProposalPdfDocument'

/** Sobe quando o layout muda sem alterar input/content, para o preview regenerar. */
export const PILOTO_PDF_LAYOUT_REVISION = 16
export const PILOTO_PDF_PAGE_COUNT = 8
export const PILOTO_PDF_PAGE_COUNT_WITH_CONTINUATION = 9

const BLACK = '#000000'
const DARK = '#0B0B0B'
const BODY = '#2A2A2A'
const SOFT_TEXT = '#6B6B6B'
const FAINT = '#A1A1AA'
const RULE = '#E2E2E2'
const SOFT_BG = '#F2F2F3'

const FONT = 'Open Sans'

/** Tipo de estilo do react-pdf, sem importar pacote transitivo. */
type Style = Parameters<typeof StyleSheet.create>[0][string]

const s = StyleSheet.create({
  headline: { fontFamily: FONT, fontWeight: 700, fontSize: 27, lineHeight: 1.3, color: BLACK, marginBottom: 20 },
  statement: { fontFamily: FONT, fontWeight: 400, fontSize: 20, lineHeight: 1.4, color: BLACK, marginBottom: 20 },
  title: { fontFamily: FONT, fontWeight: 700, fontSize: 17, lineHeight: 1.3, color: BLACK },
  body: { fontFamily: FONT, fontWeight: 400, fontSize: 17, lineHeight: 1.45, color: BODY },
  desc: { fontFamily: FONT, fontWeight: 400, fontSize: 14, lineHeight: 1.4, color: SOFT_TEXT, marginTop: 3 },
  small: { fontFamily: FONT, fontWeight: 400, fontSize: 13, lineHeight: 1.4, color: SOFT_TEXT },
  label: { fontFamily: FONT, fontWeight: 700, fontSize: 13, color: SOFT_TEXT },
  index: { fontFamily: FONT, fontWeight: 700, fontSize: 13, color: FAINT, width: 36, paddingTop: 3 },
  rule: { height: 1, backgroundColor: RULE },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  note: { fontFamily: FONT, fontWeight: 400, fontSize: 14, lineHeight: 1.45, color: SOFT_TEXT, marginTop: 14 },
})

interface PilotoPdfDocumentProps {
  input: PilotoInput
  content: PilotoAiContent
  /** Inclui a página "Se fizer sentido continuar" (padrão: true). */
  showContinuation?: boolean
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function rgba(accent: string, alpha: number): string {
  const [r, g, b] = accentColorRgbChannels(accent).split(' ')
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function LightPage({ input, accent, children }: { input: PilotoInput; accent: string; children: ReactNode }) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={P.pageLight}>
      {input.markDataUrl ? (
        <Watermark src={input.markDataUrl} anchor={input.markAnchor} scale={input.markScale} />
      ) : null}
      {children}
      <PageFooter companyName={input.companyName} websiteUrl={input.websiteUrl} accent={accent} />
    </Page>
  )
}

/** Linhas separadas por régua fina, sem caixa em volta (mesma leitura do deck). */
function Rows({ children, gap = 14 }: { children: ReactElement[]; gap?: number }) {
  return (
    <View>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={[s.rule, { marginVertical: gap }]} /> : null}
          {child}
        </View>
      ))}
    </View>
  )
}

function LineIcon({ name }: { name: 'search' | 'eye' | 'clock' }) {
  const stroke = { stroke: BLACK, strokeWidth: 1.8, fill: 'none' } as const
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'search' ? (
        <>
          <Circle cx={10.5} cy={10.5} r={6.5} {...stroke} />
          <Path d="M15.5 15.5 L20.5 20.5" {...stroke} />
        </>
      ) : null}
      {name === 'eye' ? (
        <>
          <Path d="M2.5 12 C5 7 8.5 5.5 12 5.5 C15.5 5.5 19 7 21.5 12 C19 17 15.5 18.5 12 18.5 C8.5 18.5 5 17 2.5 12 Z" {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Path d="M4 20 L20 4" {...stroke} />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5 L12 12 L15 14" {...stroke} />
        </>
      ) : null}
    </Svg>
  )
}

function SignalBars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginRight: 12 }}>
      {[1, 2, 3].map((bar) => (
        <View
          key={bar}
          style={{
            width: 5,
            height: 6 + bar * 4,
            marginRight: bar < 3 ? 3 : 0,
            backgroundColor: bar <= level ? BLACK : RULE,
          }}
        />
      ))}
    </View>
  )
}

/* ---------- Ícones (mesmos do deck) ---------- */
function PdfIcon({ name, size = 16, color = BLACK }: { name: PilotoIconName; size?: number; color?: string }) {
  const icon = PILOTO_ICONS[name]
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icon.fill?.map((d) => <Path key={d} d={d} fill={color} />)}
      {icon.stroke?.map((d) => (
        <Path key={d} d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  )
}

function IconTile({ name, size = 34 }: { name: PilotoIconName; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: SOFT_BG, alignItems: 'center', justifyContent: 'center' }}>
      <PdfIcon name={name} size={Math.round(size * 0.5)} />
    </View>
  )
}

/* ---------- Marca-texto (igual ao deck) ---------- */
/**
 * Faixa da cor de destaque atrás da metade de baixo do texto. O react-pdf não tem
 * gradiente em texto, então a faixa é um bloco absoluto atrás de uma palavra ou frase curta.
 */
function Marker({ accent, textStyle, children }: { accent: string; textStyle: Style; children: string }) {
  return (
    <View style={{ position: 'relative', alignSelf: 'flex-start' }}>
      <View style={{ position: 'absolute', left: -2, right: -2, bottom: '10%', height: '38%', backgroundColor: accent }} />
      <Text style={textStyle}>{children}</Text>
    </View>
  )
}

/**
 * Parágrafo quebrado palavra a palavra, para uma palavra no meio poder levar o marca-texto.
 * `suffix` gruda na palavra marcada sem entrar na faixa (ex.: o ponto final).
 */
function FlowText({
  parts,
  textStyle,
  accent,
  fontSize,
}: {
  parts: { text: string; mark?: boolean; suffix?: string }[]
  textStyle: Style
  accent: string
  fontSize: number
}) {
  const space = fontSize * 0.28
  const words = parts.flatMap((part) =>
    part.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index, list) => ({
        word,
        mark: Boolean(part.mark),
        suffix: index === list.length - 1 ? part.suffix ?? '' : '',
      })),
  )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {words.map((item, index) =>
        item.mark ? (
          <View key={index} style={{ flexDirection: 'row', marginRight: space }}>
            <Marker accent={accent} textStyle={textStyle}>
              {item.word}
            </Marker>
            {item.suffix ? <Text style={textStyle}>{item.suffix}</Text> : null}
          </View>
        ) : (
          <Text key={index} style={[textStyle, { marginRight: space }]}>
            {item.word}
          </Text>
        ),
      )}
    </View>
  )
}

/* ---------- Grade de três colunas (funil e fases usam a mesma) ---------- */
const COL_GAP = 12
const COL_W = (CONTENT_W - COL_GAP * 2) / 3

/* ---------- Funil horizontal, igual ao deck ---------- */
const FUNNEL_H = 214
/** Recuo comum do rótulo dentro do segmento e do texto abaixo: um eixo só por coluna. */
const FUNNEL_INSET = 18
const FUNNEL_NEUTRALS = ['#EDEDEF', '#D9D9DD']

function funnelHeightAt(x: number): number {
  return FUNNEL_H - (FUNNEL_H * 0.66 * x) / CONTENT_W
}

function funnelSegment(index: number): string {
  const start = index * (COL_W + COL_GAP)
  const end = start + COL_W
  const mid = FUNNEL_H / 2
  const hs = funnelHeightAt(start) / 2
  const he = funnelHeightAt(end) / 2
  return `M${start},${mid - hs} L${end},${mid - he} L${end},${mid + he} L${start},${mid + hs} Z`
}

/* ---------- Linha do tempo horizontal, igual ao deck ---------- */
const HALF_GAP = 24
const HALF_W = (CONTENT_W - HALF_GAP) / 2

function PhaseTimeline({ accent, onAccent }: { accent: string; onAccent: string }) {
  const first = CONTENT_W / 3
  const rest = CONTENT_W - first
  const phases = [
    { phase: PHASES.foundation, range: 'Dias 1 a 15', color: DARK },
    { phase: PHASES.traffic, range: 'Dias 16 a 45', color: accent },
  ]
  const dayStyle = { fontFamily: FONT, fontWeight: 700, fontSize: 16, color: BLACK } as const
  const dayLabel = [s.small, { fontSize: 14 }]

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: first }}>
          <Text style={dayStyle}>{MILESTONES[0].day}</Text>
          <Text style={dayLabel}>{MILESTONES[0].label}</Text>
        </View>
        <View style={{ width: rest, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={dayStyle}>{MILESTONES[1].day}</Text>
            <Text style={dayLabel}>{MILESTONES[1].label}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={dayStyle}>{MILESTONES[2].day}</Text>
            <Text style={dayLabel}>{MILESTONES[2].label}</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 10, marginTop: 8, position: 'relative' }}>
        {[0, first, CONTENT_W - 1].map((left) => (
          <View key={left} style={{ position: 'absolute', left, top: 0, width: 1, height: 10, backgroundColor: BLACK }} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', height: 66 }}>
        <View style={{ width: first, backgroundColor: DARK, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: '#FFFFFF' }}>
            {PHASES.foundation.name} · {PHASES.foundation.days}
          </Text>
        </View>
        <View style={{ width: rest, backgroundColor: accent, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: onAccent }}>
            {PHASES.traffic.name} · {PHASES.traffic.days}
          </Text>
        </View>
      </View>

      {/* Duas colunas iguais com a mesma estrutura; a faixa de cor liga cada uma à barra */}
      <View style={{ flexDirection: 'row', marginTop: 28 }}>
        {phases.map(({ phase, range, color }, index) => (
          <View key={phase.name} style={{ width: HALF_W, marginLeft: index === 0 ? 0 : HALF_GAP }}>
            <View style={{ height: 4, backgroundColor: color }} />
            <Text style={[s.small, { fontSize: 13, marginTop: 14 }]}>{range}</Text>
            <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: BLACK, marginTop: 2 }}>{phase.name}</Text>
            <Text style={[s.body, { fontSize: 15, lineHeight: 1.4, marginTop: 6, minHeight: 44 }]}>{phase.summary}</Text>
            <View style={{ marginTop: 12 }}>
              {phase.highlights.map((item) => (
                <View key={item} style={[s.row, { marginTop: 7 }]}>
                  <CheckIcon />
                  <Text style={{ fontFamily: FONT, fontSize: 14.5, lineHeight: 1.35, color: BODY, marginLeft: 9, flex: 1 }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

/* ---------- Reels ---------- */
const REEL_W = 196
const REEL_H = 320

function ReelFrame({ number, title, accent, onAccent }: { number: number; title: string; accent: string; onAccent: string }) {
  return (
    <View
      style={{
        width: REEL_W,
        height: REEL_H,
        backgroundColor: DARK,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: '#8A8A8A' }}>Vídeo {pad2(number)}</Text>
      <View style={{ alignItems: 'center' }}>
        <View
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M8 5.5 L8 18.5 L19 12 Z" fill={onAccent} />
          </Svg>
        </View>
      </View>
      <View>
        <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: '#FFFFFF' }}>{title}</Text>
        <View style={{ marginTop: 10, height: 3, backgroundColor: '#2E2E2E' }}>
          <View style={{ width: '40%', height: 3, backgroundColor: accent }} />
        </View>
      </View>
    </View>
  )
}

/* ---------- Ciclo de otimização ---------- */
const LOOP_W = 260
const LOOP_H = 250
const LOOP_C = { x: LOOP_W / 2, y: 128 }
const LOOP_R = 82
const LOOP_ANGLES = [-90, 30, 150]
const LOOP_GAP = 26

function loopPoint(angle: number) {
  const rad = (angle * Math.PI) / 180
  return { x: LOOP_C.x + LOOP_R * Math.cos(rad), y: LOOP_C.y + LOOP_R * Math.sin(rad) }
}

function loopArc(from: number, to: number): string {
  const start = loopPoint(from + LOOP_GAP)
  const end = loopPoint(to - LOOP_GAP)
  return `M${start.x},${start.y} A${LOOP_R},${LOOP_R} 0 0 1 ${end.x},${end.y}`
}

/** Ponta de seta na tangente do círculo (react-pdf não tem marker). */
function loopArrow(to: number): string {
  const angle = to - LOOP_GAP
  const tip = loopPoint(angle)
  const tangent = ((angle + 90) * Math.PI) / 180
  const back = { x: tip.x - 8 * Math.cos(tangent), y: tip.y - 8 * Math.sin(tangent) }
  const normal = tangent + Math.PI / 2
  const left = { x: back.x + 4.5 * Math.cos(normal), y: back.y + 4.5 * Math.sin(normal) }
  const right = { x: back.x - 4.5 * Math.cos(normal), y: back.y - 4.5 * Math.sin(normal) }
  return `M${tip.x},${tip.y} L${left.x},${left.y} L${right.x},${right.y} Z`
}

const LOOP_LABELS = [
  { left: 0, width: LOOP_W, top: 8, textAlign: 'center' as const },
  { left: LOOP_C.x + 60, width: 100, top: 196, textAlign: 'left' as const },
  { left: LOOP_C.x - 160, width: 100, top: 196, textAlign: 'right' as const },
]

function OptimizationLoop({ accent, halo = '#FFFFFF' }: { accent: string; halo?: string }) {
  return (
    <View style={{ width: LOOP_W, height: LOOP_H, position: 'relative' }}>
      <Svg width={LOOP_W} height={LOOP_H} viewBox={`0 0 ${LOOP_W} ${LOOP_H}`}>
        <Circle cx={LOOP_C.x} cy={LOOP_C.y} r={LOOP_R} stroke="#D4D4D8" strokeWidth={1} fill="none" />
        {LOOP_ANGLES.map((angle, index) => {
          const next = LOOP_ANGLES[(index + 1) % LOOP_ANGLES.length]
          const to = next <= angle ? next + 360 : next
          return (
            <Path key={`arc-${angle}`} d={loopArc(angle, to)} stroke={BLACK} strokeWidth={2} fill="none" />
          )
        })}
        {LOOP_ANGLES.map((angle, index) => {
          const next = LOOP_ANGLES[(index + 1) % LOOP_ANGLES.length]
          const to = next <= angle ? next + 360 : next
          return <Path key={`arrow-${angle}`} d={loopArrow(to)} fill={BLACK} />
        })}
        {LOOP_ANGLES.map((angle) => {
          const node = loopPoint(angle)
          return <Circle key={`halo-${angle}`} cx={node.x} cy={node.y} r={13} fill={halo} />
        })}
        {LOOP_ANGLES.map((angle) => {
          const node = loopPoint(angle)
          return (
            <Circle key={`node-${angle}`} cx={node.x} cy={node.y} r={9} fill={accent} stroke={BLACK} strokeWidth={2} />
          )
        })}
      </Svg>
      <View style={{ position: 'absolute', top: LOOP_C.y - 24, left: 0, width: LOOP_W, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: BLACK }}>30</Text>
        <Text style={s.small}>dias em ciclo</Text>
      </View>
      {TRAFFIC_LOOP.map((label, index) => (
        <Text
          key={label}
          style={{
            position: 'absolute',
            ...LOOP_LABELS[index],
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 14,
            color: BLACK,
          }}
        >
          {label}
        </Text>
      ))}
    </View>
  )
}

/* ---------- Celular com a conversa ---------- */
const PHONE_W = 262
const PHONE_H = 400
const LANE_Y = [72, 200, 328]

function PhoneMock({
  accent,
  name,
  messages,
}: {
  accent: string
  name: string
  messages: { from: 'lead' | 'ai'; text: string }[]
}) {
  return (
    <View style={{ width: PHONE_W, height: PHONE_H, borderRadius: 26, borderWidth: 1.5, borderColor: RULE, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: SOFT_BG, paddingHorizontal: 16, paddingVertical: 12 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: RULE, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: BLACK }}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ marginLeft: 10 }}>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: BLACK }}>{name}</Text>
          <Text style={{ fontFamily: FONT, fontSize: 10, color: SOFT_TEXT }}>online agora</Text>
        </View>
      </View>
      <View style={{ flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'space-between' }}>
        <View>
          {messages.map((message, index) =>
            message.from === 'lead' ? (
              <View
                key={index}
                style={{ alignSelf: 'flex-start', maxWidth: '82%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: RULE, borderRadius: 12, borderTopLeftRadius: 3, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 }}
              >
                <Text style={{ fontFamily: FONT, fontSize: 11.5, lineHeight: 1.35, color: BLACK }}>{message.text}</Text>
              </View>
            ) : (
              <View key={index} style={{ alignSelf: 'flex-end', maxWidth: '86%', marginBottom: 8 }}>
                {index === 1 ? (
                  <Text style={{ fontFamily: FONT, fontSize: 9, color: SOFT_TEXT, textAlign: 'right', marginBottom: 3 }}>
                    Automação · respondeu em segundos
                  </Text>
                ) : null}
                <View style={{ backgroundColor: rgba(accent, 0.28), borderRadius: 12, borderTopRightRadius: 3, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Text style={{ fontFamily: FONT, fontSize: 11.5, lineHeight: 1.35, color: BLACK }}>{message.text}</Text>
                </View>
              </View>
            ),
          )}
        </View>
        <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: DARK, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginRight: 6 }} />
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 10, color: '#FFFFFF' }}>{CHAT_HANDOFF}</Text>
        </View>
      </View>
    </View>
  )
}

function Connector() {
  const w = 44
  const startY = PHONE_H / 2
  return (
    <Svg width={w} height={PHONE_H} viewBox={`0 0 ${w} ${PHONE_H}`}>
      {LANE_Y.map((y, index) => (
        <Path
          key={y}
          d={`M0,${startY} C${w * 0.55},${startY} ${w * 0.45},${y} ${w},${y}`}
          stroke={index === 0 ? BLACK : FAINT}
          strokeWidth={index === 0 ? 2 : 1.25}
          fill="none"
        />
      ))}
      <Circle cx={2} cy={startY} r={3} fill={BLACK} />
    </Svg>
  )
}

/* ---------- Planos ---------- */
function PlanCard({
  plan,
  pricing,
  accent,
  onAccent,
  hero,
}: {
  plan: PilotoPlan
  pricing: PilotoPricing
  accent: string
  onAccent: string
  hero: boolean
}) {
  const text = hero ? '#FFFFFF' : BLACK
  const soft = hero ? '#9B9B9B' : SOFT_TEXT
  const ruleColor = hero ? '#2E2E2E' : RULE
  // Igual ao slide: o número grande é o trabalho da agência; anúncios e total ficam nas linhas.
  const rows = [
    ...plan.channels.map((channel) => ({ label: `+ Anúncios no ${channelLabel(channel)}`, value: pricing.adBudgetPerChannelCents })),
    { label: 'Total no piloto', value: plan.totalCents },
  ]

  return (
    <View
      style={{
        backgroundColor: hero ? DARK : '#FFFFFF',
        borderWidth: hero ? 0 : 1.5,
        borderColor: RULE,
        borderRadius: 12,
        paddingHorizontal: hero ? 26 : 20,
        paddingVertical: hero ? 24 : 18,
        flex: hero ? undefined : 1,
      }}
      wrap={false}
    >
      {hero ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: accent, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 12 }}>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: onAccent }}>Recomendado</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: hero ? 'row' : 'column', justifyContent: 'space-between', alignItems: hero ? 'flex-end' : 'flex-start' }}>
        <View>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: hero ? 22 : 17, color: text }}>{plan.name}</Text>
          <Text style={{ fontFamily: FONT, fontSize: 12.5, color: soft, marginTop: 2 }}>{plan.channels.map(channelLabel).join(' + ')}</Text>
        </View>
        <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: hero ? 38 : 28, color: text, marginTop: hero ? 0 : 12 }}>
          {formatCurrencyBRL(plan.agencyDealCents)}
        </Text>
      </View>
      <Text style={{ fontFamily: FONT, fontSize: 11.5, color: soft, marginTop: 4, textAlign: hero ? 'right' : 'left' }}>
        nosso trabalho, fechando na reunião
        {plan.agencyListCents > plan.agencyDealCents ? (
          <>
            {' · de '}
            <Text style={{ textDecoration: 'line-through', color: '#DC2626' }}>{formatCurrencyBRL(plan.agencyListCents)}</Text>
          </>
        ) : null}
      </Text>
      <View style={{ marginTop: hero ? 16 : 10 }}>
        {rows.map((row) => (
          <View
            key={row.label}
            style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: ruleColor, paddingVertical: 6 }}
          >
            <Text style={{ fontFamily: FONT, fontSize: 12.5, color: soft }}>{row.label}</Text>
            <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: text }}>{formatCurrencyBRL(row.value)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.4, color: hero ? '#D4D4D8' : BODY, marginTop: 10 }}>
        {plan.pitch}
      </Text>
    </View>
  )
}

function ContinuationCard({
  plan,
  accent,
  onAccent,
  hero,
}: {
  plan: ContinuationPlan
  accent: string
  onAccent: string
  hero: boolean
}) {
  const text = hero ? '#FFFFFF' : BLACK
  const soft = hero ? '#9B9B9B' : SOFT_TEXT
  const ruleColor = hero ? '#2E2E2E' : RULE
  const body = hero ? '#D4D4D8' : BODY

  return (
    <View
      style={{
        backgroundColor: hero ? DARK : '#FFFFFF',
        borderWidth: hero ? 0 : 1.5,
        borderColor: RULE,
        borderRadius: 12,
        paddingHorizontal: hero ? 26 : 20,
        paddingVertical: hero ? 24 : 18,
        flex: hero ? undefined : 1,
      }}
      wrap={false}
    >
      {hero ? (
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: accent,
            paddingHorizontal: 9,
            paddingVertical: 4,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: onAccent }}>Recomendado</Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: hero ? 'row' : 'column',
          justifyContent: 'space-between',
          alignItems: hero ? 'flex-end' : 'flex-start',
        }}
      >
        <View>
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: hero ? 22 : 17, color: text }}>
            {plan.name}
          </Text>
          {plan.note ? (
            <Text style={{ fontFamily: FONT, fontSize: 12.5, color: soft, marginTop: 2 }}>{plan.note}</Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            marginTop: hero ? 0 : 12,
          }}
        >
          <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: hero ? 38 : 28, color: text }}>
            {formatCurrencyBRL(plan.monthlyCents)}
          </Text>
          <Text style={{ fontFamily: FONT, fontSize: hero ? 14 : 12, color: soft, marginLeft: 4, marginBottom: hero ? 8 : 5 }}>
            /mês
          </Text>
        </View>
      </View>

      <View style={{ marginTop: hero ? 16 : 10 }}>
        {plan.includes.map((item) => (
          <View
            key={item}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: ruleColor,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontFamily: FONT, fontSize: 12.5, color: soft, flex: 1 }}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.4, color: body, marginTop: 10 }}>
        {plan.fit}
      </Text>
    </View>
  )
}

const SITUATION_COPY: {
  key: keyof Pick<PilotoInput, 'hasWebsite' | 'runsAds' | 'whatsappOrganized'>
  label: string
  yes: string
  no: string
}[] = [
  { key: 'hasWebsite', label: 'Site', yes: 'Tem site', no: 'Não tem' },
  { key: 'runsAds', label: 'Anúncios', yes: 'Já anuncia', no: 'Não anuncia' },
  { key: 'whatsappOrganized', label: 'WhatsApp', yes: 'Organizado', no: 'Sem processo' },
]

export function PilotoPdfDocument({
  input,
  content,
  showContinuation = false,
}: PilotoPdfDocumentProps): ReactElement {
  const accent = normalizeAccentColor(input.accentColor)
  const onAccent = accentForegroundColor(accent)
  const { pricing } = input
  const plans = getPilotoPlans(pricing)
  const completoPlan = plans.find((plan) => plan.id === 'completo') ?? plans[0]
  const singlePlan = plans.find((plan) => plan.id !== 'completo') ?? plans[0]
  const completoInstallments = calcInstallments(completoPlan.agencyDealCents, input.installmentFeeRate)
  const singleInstallments = calcInstallments(singlePlan.agencyDealCents, input.installmentFeeRate)
  const strike = (cents: number) => (
    <Text style={{ textDecoration: 'line-through', color: '#DC2626' }}>{formatCurrencyBRL(cents)}</Text>
  )
  const continuationPlans = getContinuationPlans(pricing)
  const lead = input.leadCompanyName.trim()

  const headline = content.diagnosisHeadline.trim()
  const diagnosisLines = content.diagnosisLines.filter((line) => line.trim().length > 0)
  const funnelLabels = [content.funnelTopLabel, content.funnelMiddleLabel, content.funnelBottomLabel]
  const angles = [0, 1, 2].map((index) => content.adAngles[index] ?? { title: '', description: '' })
  const closing = content.closingParagraph.trim() || CLOSING_FALLBACK
  const hero = plans.find((plan) => plan.highlighted) ?? plans[0]
  const others = plans.filter((plan) => plan.id !== hero.id)
  const situation = SITUATION_COPY.flatMap((item) => {
    const answer: SituationAnswer = input[item.key]
    return answer === 'nao_sei' ? [] : [{ label: item.label, value: answer === 'sim' ? item.yes : item.no, gap: answer === 'nao' }]
  })

  return (
    <Document>
      {/* 1 · Capa — mesma estrutura da capa da proposta */}
      <Page size={[PAGE_W, PAGE_H]} style={P.pageDark}>
        <DarkBackground />
        <CoverLogo logoDataUrl={input.logoDataUrl} companyName={input.companyName} />
        <View style={P.coverTop}>
          <Text style={P.coverLabel}>PROPOSTA COMERCIAL</Text>
          <Text style={P.coverTagline}>{(lead || 'Piloto 45').toUpperCase()}</Text>
        </View>
        <View style={P.coverCenter}>
          <Text style={P.coverTitle}>
            Piloto <Text style={{ color: accent }}>45</Text>
          </Text>
          <View style={[P.yellowBar, { backgroundColor: accent }]} />
          <Text style={P.coverSubtitle}>{pilotoPromise(lead)}</Text>
        </View>
        <PageFooter companyName={input.companyName} websiteUrl={input.websiteUrl} tone="dark" accent={accent} />
      </Page>

      {/* 2 · Cenário + onde o cliente se perde */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="O cenário hoje" accent={accent} />
          <Text style={[s.headline, headline ? {} : { color: SOFT_TEXT }]}>{headline || 'Diagnóstico ainda não gerado.'}</Text>
          {diagnosisLines.length > 0 ? (
            <Rows>
              {diagnosisLines.map((line, index) => (
                <View key={`${line}-${index}`} style={s.row}>
                  <Text style={s.index}>{pad2(index + 1)}</Text>
                  <Text style={[s.body, { flex: 1 }]}>{line}</Text>
                </View>
              ))}
            </Rows>
          ) : (
            <View />
          )}
          {situation.length > 0 ? (
            <View style={{ marginTop: 24, backgroundColor: SOFT_BG, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 16 }}>
              <Text style={[s.label, { marginBottom: 8 }]}>Onde a empresa está</Text>
              <View style={{ flexDirection: 'row' }}>
                {situation.map((item) => (
                  <View key={item.label} style={{ flex: 1 }}>
                    <Text style={s.small}>{item.label}</Text>
                    <View style={{ marginTop: 3 }}>
                      {item.gap ? (
                        <Marker accent={accent} textStyle={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: BLACK }}>
                          {item.value}
                        </Marker>
                      ) : (
                        <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: SOFT_TEXT }}>{item.value}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View />
          )}
        </View>

        <View style={P.sectionBlock} wrap={false}>
          <SectionHeading title="Onde o cliente se perde" accent={accent} />
          <View style={{ marginBottom: 20 }}>
            <FlowText
              accent={accent}
              fontSize={27}
              textStyle={{ fontFamily: FONT, fontWeight: 700, fontSize: 27, lineHeight: 1.3, color: BLACK }}
              parts={[
                { text: 'O problema não é falta de cliente. É que o caminho até você tem' },
                { text: 'falhas', mark: true, suffix: '.' },
              ]}
            />
          </View>
          {LEAKS.map((leak, index) => (
            <View
              key={leak.title}
              style={{ flexDirection: 'row', borderTopWidth: 2, borderTopColor: BLACK, paddingTop: 12, marginTop: index === 0 ? 0 : 16 }}
            >
              <View style={{ width: 40 }}>
                <LineIcon name={(['search', 'eye', 'clock'] as const)[index]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{leak.title}</Text>
                <Text style={s.desc}>{leak.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </LightPage>

      {/* 3 · Caminho (funil) + duas fases — mesma grade de colunas */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="O caminho que vamos construir" accent={accent} />
          <View style={{ height: FUNNEL_H, position: 'relative' }}>
            <Svg width={CONTENT_W} height={FUNNEL_H} viewBox={`0 0 ${CONTENT_W} ${FUNNEL_H}`}>
              {FUNNEL_STAGES.map((stage, index) => (
                <Path key={stage.name} d={funnelSegment(index)} fill={index === 2 ? accent : FUNNEL_NEUTRALS[index]} />
              ))}
            </Svg>
            {FUNNEL_STAGES.map((stage, index) => (
              <View
                key={`${stage.name}-label`}
                style={{
                  position: 'absolute',
                  left: index * (COL_W + COL_GAP),
                  top: 0,
                  width: COL_W,
                  height: FUNNEL_H,
                  justifyContent: 'center',
                  paddingLeft: FUNNEL_INSET,
                }}
              >
                <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: index === 2 ? onAccent : SOFT_TEXT }}>
                  {pad2(index + 1)}
                </Text>
                <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 23, color: index === 2 ? onAccent : BLACK }}>
                  {stage.name}
                </Text>
              </View>
            ))}
          </View>
          {/*
            Descrição sob cada segmento. Sem altura fixa: o texto precisa aparecer inteiro
            (sem reticências). O traço fica logo abaixo de cada coluna.
          */}
          <View style={{ flexDirection: 'row', marginTop: 18 }}>
            {FUNNEL_STAGES.map((stage, index) => (
              <View
                key={`${stage.name}-col`}
                style={{ width: COL_W, marginLeft: index === 0 ? 0 : COL_GAP, paddingLeft: FUNNEL_INSET, paddingRight: 8 }}
              >
                <Text style={[s.body, { fontSize: 15, lineHeight: 1.4 }]}>
                  {funnelLabels[index].trim() || 'Etapa ainda não descrita.'}
                </Text>
                <View style={{ width: 28, height: 2, backgroundColor: index === 2 ? accent : BLACK, marginTop: 10, marginBottom: 12 }} />
                {stage.channels.map((channel) => (
                  <View key={channel.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7 }}>
                    <PdfIcon name={channel.icon} size={13} />
                    <Text style={[s.small, { fontSize: 13, marginLeft: 6 }]}>{channel.label}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[P.sectionBlock, { marginTop: 80 }]} wrap={false}>
          <SectionHeading title="45 dias, duas fases" accent={accent} />
          <PhaseTimeline accent={accent} onAccent={onAccent} />
        </View>
      </LightPage>

      {/* 4 · Fundação */}
      <LightPage input={input} accent={accent}>
        <View>
          <SectionHeading title="Fundação · dias 1 a 15" accent={accent} />
          <Text style={s.statement}>Tudo pronto antes do primeiro anúncio.</Text>
          {FOUNDATION_GROUPS.map((group, groupIndex) => (
            <View key={group.name} wrap={false} style={{ marginTop: groupIndex === 0 ? 8 : 44 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: BLACK, paddingBottom: 8, marginBottom: 12 }}>
                <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 19, color: BLACK }}>{group.name}</Text>
                <Text style={s.small}>{group.items.length} entregas</Text>
              </View>
              <Rows gap={15}>
                {group.items.map((item) => (
                  <View key={item.title} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.icon ? <IconTile name={item.icon} size={40} /> : null}
                    <View style={{ flex: 1, marginLeft: item.icon ? 16 : 0 }}>
                      <Text style={[s.title, { fontSize: 18 }]}>{item.title}</Text>
                      <Text style={[s.desc, { fontSize: 14.5 }]}>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </Rows>
            </View>
          ))}
        </View>
      </LightPage>

      {/* 5 · Vídeos + tráfego */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Três vídeos, três ângulos" accent={accent} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {angles.map((angle, index) => (
              <View key={index} style={{ width: REEL_W }}>
                <ReelFrame number={index + 1} title={angle.title.trim() || 'Ângulo a definir'} accent={accent} onAccent={onAccent} />
                <Text style={[s.small, { marginTop: 10 }]}>
                  {angle.description.trim() || 'Definido no briefing, com base no que o seu cliente mais pergunta.'}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.note}>{VIDEOS_NOTE}</Text>
        </View>

        <View style={P.sectionBlock} wrap={false}>
          <SectionHeading title="Tráfego · dias 16 a 45" accent={accent} />
          {/* Duas metades iguais, como no dia 45: o ciclo num painel suave, os itens ao lado */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: HALF_W, backgroundColor: SOFT_BG, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }}>
              <OptimizationLoop accent={accent} halo={SOFT_BG} />
            </View>
            <View style={{ width: HALF_W, marginLeft: HALF_GAP, justifyContent: 'center' }}>
              <Rows gap={11}>
                {trafficItems(pricing.adBudgetPerChannelCents).map((item) => (
                  <View key={item.title}>
                    <Text style={[s.title, { fontSize: 15.5 }]}>{item.title}</Text>
                    <Text style={[s.desc, { fontSize: 13.5 }]}>{item.description}</Text>
                  </View>
                ))}
              </Rows>
            </View>
          </View>
        </View>
      </LightPage>

      {/* 6 · Atendimento + dia 45 */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Nenhuma conversa se perde" accent={accent} />
          <Text style={[s.body, { marginBottom: 18 }]}>{QUALIFICATION_COPY}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PhoneMock accent={accent} name={lead || 'Seu negócio'} messages={resolveChat(content.chatMessages ?? [])} />
            <Connector />
            <View style={{ flex: 1, height: PHONE_H, position: 'relative' }}>
              {TEMPERATURE_LANES.map((lane, index) => (
                <View key={lane.name} style={{ position: 'absolute', left: 10, right: 0, top: LANE_Y[index] - 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <SignalBars level={lane.level} />
                    <Text style={[s.title, { fontSize: 17 }]}>{lane.name}</Text>
                  </View>
                  <Text style={[s.desc, { marginLeft: 33 }]}>{lane.action}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <Marker accent={accent} textStyle={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: BLACK }}>
              {COMPARISON_TAGLINE}
            </Marker>
          </View>
        </View>

        <View style={[P.sectionBlock, { marginTop: 40 }]} wrap={false}>
          <SectionHeading title="No dia 45: você decide com números" accent={accent} />
          <Text style={[s.body, { fontSize: 15, marginBottom: 12 }]}>{PILOT_GOAL}</Text>
          <View style={{ borderWidth: 1, borderColor: RULE }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: DARK, paddingHorizontal: 20, paddingVertical: 12 }}>
              <View>
                <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: '#FFFFFF' }}>Relatório final</Text>
                <Text style={{ fontFamily: FONT, fontSize: 11, color: '#8A8A8A' }}>Piloto 45{lead ? ` · ${lead}` : ''}</Text>
              </View>
              <View style={{ width: 8, height: 8, backgroundColor: accent }} />
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              {REPORT_METRICS.map((metric, index) => (
                <View
                  key={metric}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: index === 0 ? 0 : 1, borderTopColor: RULE, paddingVertical: 6.5 }}
                >
                  <Text style={{ fontFamily: FONT, fontSize: 13, color: BODY }}>{metric}</Text>
                  <View style={{ width: [70, 62, 44, 90, 76][index], height: 8, backgroundColor: RULE, borderRadius: 2 }} />
                </View>
              ))}
            </View>
          </View>

          {/* O que é dele (fundo cheio) × o que é opcional (borda tracejada) */}
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <View style={{ flex: 1, marginRight: 12, backgroundColor: SOFT_BG, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16 }}>
              <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: BLACK, marginBottom: 6 }}>Fica com você</Text>
              {ASSETS_THAT_STAY.map((asset) => (
                <View key={asset} style={[s.row, { marginTop: 6 }]}>
                  <CheckIcon />
                  <Text style={{ fontFamily: FONT, fontSize: 13.5, lineHeight: 1.35, color: BLACK, marginLeft: 8, flex: 1 }}>{asset}</Text>
                </View>
              ))}
            </View>
            <View
              style={{
                flex: 1,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: '#C9C9CE',
                borderRadius: 12,
                paddingHorizontal: 18,
                paddingVertical: 16,
              }}
            >
              <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: BLACK, marginBottom: 6 }}>
                Continua se você quiser
              </Text>
              {CONTINUES_IF_YOU_WANT.map((item) => (
                <View key={item.title} style={{ marginTop: 6 }}>
                  <Text style={{ fontFamily: FONT, fontSize: 13.5, lineHeight: 1.35, color: BODY }}>{item.title}</Text>
                  <Text style={{ fontFamily: FONT, fontSize: 11.5, lineHeight: 1.35, color: FAINT }}>{item.description}</Text>
                </View>
              ))}
              <View style={{ borderTopWidth: 1, borderTopColor: RULE, marginTop: 10, paddingTop: 8 }}>
                <Text style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: SOFT_TEXT }}>
                  Planos a partir de {formatCurrencyBRL(continuationFromCents(pricing))}/mês
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LightPage>

      {/* 7 · Investimento + próximos passos */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Investimento" accent={accent} />
          <PlanCard plan={hero} pricing={pricing} accent={accent} onAccent={onAccent} hero />
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {others.map((plan, index) => (
              <View key={plan.id} style={{ flex: 1, marginLeft: index === 0 ? 0 : 14, flexDirection: 'row' }}>
                <PlanCard plan={plan} pricing={pricing} accent={accent} onAccent={onAccent} hero={false} />
              </View>
            ))}
          </View>

          <View style={[P.paymentBlock, { marginTop: 18 }]}>
            <View style={P.paymentRow}>
              <View style={[P.paymentAccent, { backgroundColor: accent }]} />
              <View style={P.paymentContent}>
                <Text style={P.paymentLabel}>Condição de fechamento</Text>
                <Text style={[P.paymentBody, { fontSize: 16 }]}>
                  Nosso trabalho fechando na reunião: Completo
                  {completoPlan.agencyListCents > completoPlan.agencyDealCents ? <> de {strike(completoPlan.agencyListCents)}</> : null} por{' '}
                  <Text style={[P.paymentBodyBold, { fontSize: 16 }]}>{formatCurrencyBRL(completoPlan.agencyDealCents)}</Text>, Instagram ou Google
                  {singlePlan.agencyListCents > singlePlan.agencyDealCents ? <> de {strike(singlePlan.agencyListCents)}</> : null} por{' '}
                  <Text style={[P.paymentBodyBold, { fontSize: 16 }]}>{formatCurrencyBRL(singlePlan.agencyDealCents)}</Text>. À vista no Pix ou em até 10x no cartão:{' '}
                  <Text style={[P.paymentBodyBold, { fontSize: 16 }]}>{formatCurrencyBRL(completoInstallments.installmentCents)}</Text> no Completo (total{' '}
                  {formatCurrencyBRL(completoInstallments.totalCents)}) e{' '}
                  <Text style={[P.paymentBodyBold, { fontSize: 16 }]}>{formatCurrencyBRL(singleInstallments.installmentCents)}</Text> nos outros (total{' '}
                  {formatCurrencyBRL(singleInstallments.totalCents)}).
                </Text>
                <Text style={[s.small, { marginTop: 8 }]}>{AD_BUDGET_NOTE}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[P.sectionBlock, { marginTop: 40 }]} wrap={false}>
          <SectionHeading title="Próximos passos" accent={accent} />
          {NEXT_STEPS.map((step, index) => (
            <View key={step.what} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={[P.stepCircle, { width: 34, height: 34, borderRadius: 17 }]}>
                <Text style={[P.stepNumber, { color: accent, fontSize: 14 }]}>{pad2(index + 1)}</Text>
              </View>
              <View style={{ marginLeft: 16, flex: 1 }}>
                <Text style={[s.small, { fontSize: 12 }]}>{step.when}</Text>
                <Text style={{ fontFamily: FONT, fontSize: 16.5, lineHeight: 1.3, color: BLACK }}>{step.what}</Text>
                {step.detail ? <Text style={[s.small, { fontSize: 12.5, marginTop: 1 }]}>{step.detail}</Text> : null}
              </View>
            </View>
          ))}
          <Text style={[s.note, { marginTop: 6 }]}>{RECURRENCE_NOTE}</Text>
        </View>
      </LightPage>

      {showContinuation ? (
        <LightPage input={input} accent={accent}>
          <View wrap={false}>
            <SectionHeading title="Se fizer sentido continuar" accent={accent} />
            <Text style={[s.body, { fontSize: 15, marginBottom: 18 }]}>
              Depois dos 45 dias, você decide. Nada é automático.
            </Text>
            {(() => {
              const heroPlan =
                continuationPlans.find((plan) => plan.highlighted) ?? continuationPlans[continuationPlans.length - 1]
              const sidePlans = continuationPlans.filter((plan) => plan.id !== heroPlan.id)
              return (
                <View>
                  <View style={{ flexDirection: 'row' }}>
                    {sidePlans.map((plan, index) => (
                      <View
                        key={plan.id}
                        style={{ flex: 1, marginLeft: index === 0 ? 0 : 14, flexDirection: 'row' }}
                      >
                        <ContinuationCard plan={plan} accent={accent} onAccent={onAccent} hero={false} />
                      </View>
                    ))}
                  </View>
                  <View style={{ marginTop: 14 }}>
                    <ContinuationCard plan={heroPlan} accent={accent} onAccent={onAccent} hero />
                  </View>
                </View>
              )
            })()}
            <Text style={[s.note, { marginTop: 20 }]}>{RECURRENCE_NOTE}</Text>
          </View>
        </LightPage>
      ) : null}

      {/* Fechamento — mesma estrutura do fechamento da proposta */}
      <Page size={[PAGE_W, PAGE_H]} style={P.pageDark}>
        <DarkBackground />
        <CoverLogo logoDataUrl={input.logoDataUrl} companyName={input.companyName} />
        <View style={P.coverTop}>
          <Text style={P.coverLabel}>PROPOSTA COMERCIAL</Text>
          <Text style={P.coverTagline}>{(lead || 'Piloto 45').toUpperCase()}</Text>
        </View>
        <View style={P.coverCenter}>
          <Text style={P.closingTitle}>Vamos começar?</Text>
          <Text style={P.closingParagraph}>{closing}</Text>
          <View style={[P.closingDivider, { backgroundColor: accent }]} />
          <Text style={[P.closingName, { color: accent }]}>{input.professionalName}</Text>
        </View>
        <PageFooter
          companyName={input.companyName}
          websiteUrl={input.websiteUrl}
          closing
          tone="dark"
          accent={accent}
          validityDays={input.validityDays > 0 ? input.validityDays : 15}
        />
      </Page>
    </Document>
  )
}

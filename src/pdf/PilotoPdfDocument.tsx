import type { ReactElement } from 'react'
import { Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer'
import {
  AD_BUDGET_NOTE,
  ASSETS_THAT_STAY,
  CLOSING_FALLBACK,
  FOUNDATION_GROUPS,
  FUNNEL_STAGES,
  LEAKS,
  MILESTONES,
  NEXT_STEPS,
  PHASES,
  PROBLEM_STATEMENT,
  QUALIFICATION_COPY,
  RECURRENCE_NOTE,
  REPORT_METRICS,
  TEMPERATURE_LANES,
  TRAFFIC_ITEMS,
  VIDEOS_NOTE,
  pilotoPromise,
} from '../lib/pilotoContent'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import {
  AGENCY_DEAL_CENTS,
  AGENCY_LIST_CENTS,
  PILOTO_PLANS,
  calcInstallments,
} from '../lib/pilotoPricing'
import type { PilotoAiContent, PilotoInput } from '../types/piloto'
import { accentForegroundColor, normalizeAccentColor } from '../types/proposalDoc'
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
export const PILOTO_PDF_LAYOUT_REVISION = 3
export const PILOTO_PDF_PAGE_COUNT = 8

const BLACK = '#000000'
const DARK = '#0B0B0B'
const BODY = '#2A2A2A'
const SOFT_TEXT = '#6B6B6B'
const LIGHT_BG = '#E8E8E8'
const RULE = '#D4D4D4'

const s = StyleSheet.create({
  headline: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 27,
    lineHeight: 1.3,
    color: BLACK,
    marginBottom: 26,
  },
  statement: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    lineHeight: 1.4,
    color: BLACK,
    marginBottom: 22,
  },
  card: {
    backgroundColor: LIGHT_BG,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 26,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  cardDivider: {
    height: 1,
    backgroundColor: RULE,
  },
  rowIndex: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: SOFT_TEXT,
    width: 38,
    paddingTop: 2,
  },
  rowBody: {
    flex: 1,
  },
  rowText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 18,
    lineHeight: 1.4,
    color: BODY,
  },
  rowTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 1.3,
    color: BLACK,
  },
  rowDesc: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.4,
    color: SOFT_TEXT,
    marginTop: 3,
  },
  checkGap: {
    width: 14,
  },
  groupName: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: SOFT_TEXT,
    marginBottom: 10,
    marginTop: 22,
  },
  note: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.45,
    color: SOFT_TEXT,
    marginTop: 14,
  },
  phaseBar: {
    flexDirection: 'row',
    height: 56,
  },
  phaseCell: {
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  phaseCellText: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 16,
  },
  milestones: {
    flexDirection: 'row',
    marginTop: 12,
  },
  milestoneDay: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 14,
    color: BLACK,
  },
  milestoneLabel: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 13,
    color: SOFT_TEXT,
    marginTop: 2,
  },
  phaseNotes: {
    flexDirection: 'row',
    marginTop: 24,
  },
  laneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  laneChip: {
    width: 12,
    height: 12,
    marginRight: 14,
  },
  laneName: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    color: BLACK,
    width: 96,
  },
  laneAction: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 16,
    color: BODY,
    flex: 1,
  },
  /** Texto em coluna: sem flex, senão o react-pdf zera a altura e as linhas se sobrepõem. */
  stageLabel: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 16,
    lineHeight: 1.35,
    color: BODY,
  },
  planName: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    lineHeight: 1.3,
    color: '#FFFFFF',
  },
  planSub: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 13,
    lineHeight: 1.3,
    color: '#9B9B9B',
    marginTop: 3,
  },
  stepWhen: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: SOFT_TEXT,
  },
  stepWhat: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    color: BLACK,
    marginTop: 1,
  },
  strike: {
    textDecoration: 'line-through',
    color: SOFT_TEXT,
  },
})

/** Funil vertical da página 3: faixas afunilando de cima para baixo. */
const FUNNEL_EDGES = [CONTENT_W, 500, 352, 204]
const FUNNEL_BAND_H = 88
const FUNNEL_GAP = 10
const FUNNEL_H = FUNNEL_BAND_H * 3 + FUNNEL_GAP * 2
/** Cinza, cinza, destaque: só a venda ganha cor (igual ao deck). */
const FUNNEL_NEUTRALS = ['#EDEDEF', '#D9D9DD']

function funnelBand(index: number): string {
  const top = FUNNEL_EDGES[index]
  const bottom = FUNNEL_EDGES[index + 1]
  const y = index * (FUNNEL_BAND_H + FUNNEL_GAP)
  const topX = (CONTENT_W - top) / 2
  const bottomX = (CONTENT_W - bottom) / 2
  return `M${topX},${y} L${topX + top},${y} L${bottomX + bottom},${y + FUNNEL_BAND_H} L${bottomX},${y + FUNNEL_BAND_H} Z`
}

interface PilotoPdfDocumentProps {
  input: PilotoInput
  content: PilotoAiContent
}

function LightPage({
  input,
  accent,
  children,
}: {
  input: PilotoInput
  accent: string
  children: ReactElement | ReactElement[]
}) {
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

function Card({ children }: { children: ReactElement[] }) {
  return (
    <View style={s.card} wrap={false}>
      {children.map((child, index) => (
        <View key={index}>
          {index > 0 ? <View style={s.cardDivider} /> : null}
          {child}
        </View>
      ))}
    </View>
  )
}

/** Intensidade em barras, igual ao deck: legível sem depender da cor. */
function SignalBars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginRight: 14 }}>
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

function CheckRow({ title, description }: { title: string; description?: string }) {
  return (
    <View style={s.cardRow}>
      <CheckIcon />
      <View style={s.checkGap} />
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{title}</Text>
        {description ? <Text style={s.rowDesc}>{description}</Text> : null}
      </View>
    </View>
  )
}

export function PilotoPdfDocument({ input, content }: PilotoPdfDocumentProps): ReactElement {
  const accent = normalizeAccentColor(input.accentColor)
  const onAccent = accentForegroundColor(accent)
  const installments = calcInstallments(AGENCY_DEAL_CENTS, input.installmentFeeRate)
  const lead = input.leadCompanyName.trim()

  const headline = content.diagnosisHeadline.trim()
  const diagnosisLines = content.diagnosisLines.filter((line) => line.trim().length > 0)
  const funnelLabels = [content.funnelTopLabel, content.funnelMiddleLabel, content.funnelBottomLabel]
  const angles = content.adAngles.filter((angle) => angle.title.trim().length > 0)
  const closing = content.closingParagraph.trim() || CLOSING_FALLBACK
  const plansByEmphasis = [...PILOTO_PLANS].sort(
    (a, b) => Number(b.highlighted) - Number(a.highlighted),
  )

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
          <Text style={P.coverTitle}>Piloto 45</Text>
          <View style={[P.yellowBar, { backgroundColor: accent }]} />
          <Text style={P.coverSubtitle}>{pilotoPromise(lead)}</Text>
        </View>
        <PageFooter companyName={input.companyName} websiteUrl={input.websiteUrl} tone="dark" accent={accent} />
      </Page>

      {/* 2 · Diagnóstico + onde o cliente se perde */}
      <LightPage input={input} accent={accent}>
        <View>
          <SectionHeading title="O cenário hoje" accent={accent} />
          <Text style={[s.headline, headline ? {} : { color: SOFT_TEXT }]}>
            {headline || 'Diagnóstico ainda não gerado.'}
          </Text>
          {diagnosisLines.length > 0 ? (
            <Card>
              {diagnosisLines.map((line, index) => (
                <View key={`${line}-${index}`} style={s.cardRow}>
                  <Text style={s.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={[s.rowText, s.rowBody]}>{line}</Text>
                </View>
              ))}
            </Card>
          ) : (
            <View />
          )}
        </View>
        <View style={P.sectionBlock}>
          <SectionHeading title="Onde o cliente se perde" accent={accent} />
          <Text style={s.statement}>{PROBLEM_STATEMENT}</Text>
          <Card>
            {LEAKS.map((leak, index) => (
              <View key={leak.title} style={s.cardRow}>
                <Text style={s.rowIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{leak.title}</Text>
                  <Text style={s.rowDesc}>{leak.description}</Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      </LightPage>

      {/* 3 · O caminho (funil) + como funciona (fases) */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="O caminho que vamos construir" accent={accent} />
          <View style={{ height: FUNNEL_H, position: 'relative' }}>
            <Svg width={CONTENT_W} height={FUNNEL_H} viewBox={`0 0 ${CONTENT_W} ${FUNNEL_H}`}>
              {FUNNEL_STAGES.map((stage, index) => (
                <Path key={stage.name} d={funnelBand(index)} fill={index === 2 ? accent : FUNNEL_NEUTRALS[index]} />
              ))}
            </Svg>
            {FUNNEL_STAGES.map((stage, index) => (
              <View
                key={`${stage.name}-label`}
                style={{
                  position: 'absolute',
                  top: index * (FUNNEL_BAND_H + FUNNEL_GAP) + 30,
                  left: 0,
                  width: CONTENT_W,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Open Sans',
                    fontWeight: 700,
                    fontSize: 20,
                    color: index === 2 ? onAccent : BLACK,
                  }}
                >
                  {stage.name}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 20 }}>
            {FUNNEL_STAGES.map((stage, index) => (
              <View key={`${stage.name}-row`} style={[s.laneRow, { alignItems: 'flex-start' }]}>
                <View
                  style={[s.laneChip, { marginTop: 5, backgroundColor: index === 2 ? accent : FUNNEL_NEUTRALS[index], borderWidth: 1, borderColor: '#BDBDC2' }]}
                />
                <Text style={s.laneName}>{stage.name}</Text>
                <View style={s.rowBody}>
                  <Text style={s.stageLabel}>{funnelLabels[index].trim() || 'Etapa ainda não descrita.'}</Text>
                  <Text style={s.rowDesc}>{stage.channels.join(' · ')}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={P.sectionBlock} wrap={false}>
          <SectionHeading title="Como funciona" accent={accent} />
          <View style={s.phaseBar}>
            <View style={[s.phaseCell, { width: CONTENT_W / 3, backgroundColor: DARK }]}>
              <Text style={[s.phaseCellText, { color: '#FFFFFF' }]}>
                {PHASES.foundation.name} · {PHASES.foundation.days}
              </Text>
            </View>
            <View style={[s.phaseCell, { width: (CONTENT_W / 3) * 2, backgroundColor: accent }]}>
              <Text style={[s.phaseCellText, { color: onAccent }]}>
                {PHASES.traffic.name} · {PHASES.traffic.days}
              </Text>
            </View>
          </View>
          <View style={s.milestones}>
            <View style={{ width: CONTENT_W / 3 }}>
              <Text style={s.milestoneDay}>{MILESTONES[0].day}</Text>
              <Text style={s.milestoneLabel}>{MILESTONES[0].label}</Text>
            </View>
            <View style={{ width: CONTENT_W / 3 }}>
              <Text style={s.milestoneDay}>{MILESTONES[1].day}</Text>
              <Text style={s.milestoneLabel}>{MILESTONES[1].label}</Text>
            </View>
            <View style={{ width: CONTENT_W / 3, alignItems: 'flex-end' }}>
              <Text style={s.milestoneDay}>{MILESTONES[2].day}</Text>
              <Text style={s.milestoneLabel}>{MILESTONES[2].label}</Text>
            </View>
          </View>
          <View style={s.phaseNotes}>
            <View style={{ width: CONTENT_W / 2, paddingRight: 20 }}>
              <Text style={s.rowTitle}>{PHASES.foundation.name}</Text>
              <Text style={s.rowDesc}>{PHASES.foundation.summary}</Text>
            </View>
            <View style={{ width: CONTENT_W / 2 }}>
              <Text style={s.rowTitle}>{PHASES.traffic.name}</Text>
              <Text style={s.rowDesc}>{PHASES.traffic.summary}</Text>
            </View>
          </View>
        </View>
      </LightPage>

      {/* 4 · Fundação */}
      <LightPage input={input} accent={accent}>
        <View>
          <SectionHeading title="Fundação · dias 1 a 15" accent={accent} />
          <Text style={s.statement}>Tudo pronto antes do primeiro anúncio.</Text>
          {FOUNDATION_GROUPS.map((group, groupIndex) => (
            <View key={group.name} wrap={false}>
              <Text style={[s.groupName, groupIndex === 0 ? { marginTop: 0 } : {}]}>{group.name}</Text>
              <Card>
                {group.items.map((item) => (
                  <CheckRow key={item.title} title={item.title} description={item.description} />
                ))}
              </Card>
            </View>
          ))}
        </View>
      </LightPage>

      {/* 5 · Vídeos + tráfego */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Três vídeos, três ângulos" accent={accent} />
          {angles.length > 0 ? (
            angles.map((angle, index) => (
              <View key={`${angle.title}-${index}`} style={[P.stepRow, { alignItems: 'flex-start' }]}>
                <View style={P.stepCircle}>
                  <Text style={[P.stepNumber, { color: accent }]}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={{ marginLeft: 18, flex: 1 }}>
                  <Text style={s.rowTitle}>{angle.title}</Text>
                  {angle.description.trim() ? <Text style={s.rowDesc}>{angle.description}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={s.rowText}>Os três ângulos são definidos no briefing.</Text>
          )}
          <Text style={s.note}>{VIDEOS_NOTE}</Text>
        </View>

        <View style={P.sectionBlock}>
          <SectionHeading title="Tráfego · dias 16 a 45" accent={accent} />
          <Text style={s.statement}>Verba real, dado real, ajuste constante.</Text>
          <Card>
            {TRAFFIC_ITEMS.map((item) => (
              <CheckRow key={item.title} title={item.title} description={item.description} />
            ))}
          </Card>
        </View>
      </LightPage>

      {/* 6 · Atendimento + dia 45 */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Atendimento com IA" accent={accent} />
          <Text style={s.statement}>{QUALIFICATION_COPY}</Text>
          <Card>
            {TEMPERATURE_LANES.map((lane) => (
              <View key={lane.name} style={s.laneRow}>
                <SignalBars level={lane.level} />
                <Text style={s.laneName}>{lane.name}</Text>
                <Text style={s.laneAction}>{lane.action}</Text>
              </View>
            ))}
          </Card>
        </View>

        <View style={P.sectionBlock} wrap={false}>
          <SectionHeading title="No dia 45" accent={accent} />
          <Text style={s.statement}>Você decide com números, não com achismo. O relatório final mostra:</Text>
          <Card>
            {REPORT_METRICS.map((metric) => (
              <CheckRow key={metric} title={metric} />
            ))}
          </Card>
          <Text style={s.note}>
            Fica com você: {ASSETS_THAT_STAY.map((asset) => asset.charAt(0).toLowerCase() + asset.slice(1)).join(', ')}.
          </Text>
        </View>
      </LightPage>

      {/* 7 · Investimento + próximos passos */}
      <LightPage input={input} accent={accent}>
        <View wrap={false}>
          <SectionHeading title="Investimento" accent={accent} />
          <View style={P.investmentBlock}>
            {plansByEmphasis.map((plan, index) => (
              <View key={plan.id}>
                {index > 0 ? <View style={P.investmentDivider} /> : null}
                <View style={P.investmentRow}>
                  <View style={[P.paymentAccent, { backgroundColor: plan.highlighted ? accent : '#3F3F46' }]} />
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={s.planName}>
                      {plan.name}
                      {plan.highlighted ? ' · recomendado' : ''}
                    </Text>
                    <Text style={s.planSub}>Agência + verba {plan.channels.join(' + ')}</Text>
                  </View>
                  <Text style={[P.investmentValue, { color: plan.highlighted ? accent : '#FFFFFF' }]}>
                    {formatCurrencyBRL(plan.totalCents)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={P.paymentBlock}>
            <View style={P.paymentRow}>
              <View style={[P.paymentAccent, { backgroundColor: accent }]} />
              <View style={P.paymentContent}>
                <Text style={P.paymentLabel}>Condição de fechamento</Text>
                <Text style={P.paymentBody}>
                  Agência de <Text style={s.strike}>{formatCurrencyBRL(AGENCY_LIST_CENTS)}</Text> por{' '}
                  <Text style={P.paymentBodyBold}>{formatCurrencyBRL(AGENCY_DEAL_CENTS)}</Text>. À vista no Pix ou em
                  até 10x de <Text style={P.paymentBodyBold}>{formatCurrencyBRL(installments.installmentCents)}</Text>{' '}
                  no cartão (total {formatCurrencyBRL(installments.totalCents)}).
                </Text>
              </View>
            </View>
            <View style={P.paymentDivider} />
            <View style={P.paymentRow}>
              <View style={[P.paymentAccent, { backgroundColor: accent }]} />
              <View style={P.paymentContent}>
                <Text style={P.paymentLabel}>Verba de anúncio</Text>
                <Text style={P.paymentBody}>{AD_BUDGET_NOTE}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={P.sectionBlock} wrap={false}>
          <SectionHeading title="Próximos passos" accent={accent} />
          {NEXT_STEPS.map((step, index) => (
            <View key={step.what} style={P.stepRow}>
              <View style={P.stepCircle}>
                <Text style={[P.stepNumber, { color: accent }]}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={{ marginLeft: 18, flex: 1 }}>
                <Text style={s.stepWhen}>{step.when}</Text>
                <Text style={s.stepWhat}>{step.what}</Text>
              </View>
            </View>
          ))}
          <Text style={s.note}>{RECURRENCE_NOTE}</Text>
        </View>
      </LightPage>

      {/* 8 · Fechamento — mesma estrutura do fechamento da proposta */}
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

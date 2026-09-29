import type { ReactElement } from 'react'
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import {
  AD_BUDGET_NOTE,
  FOUNDATION_ITEMS,
  NEXT_STEPS,
  RECURRENCE_NOTE,
  TRAFFIC_ITEMS,
} from '../lib/pilotoContent'
import { formatCurrencyBRL } from '../lib/currencyBRL'
import {
  AGENCY_DEAL_CENTS,
  AGENCY_LIST_CENTS,
  PILOTO_PLANS,
  calcInstallments,
} from '../lib/pilotoPricing'
import type { PilotoAiContent, PilotoInput } from '../types/piloto'
import { normalizeAccentColor } from '../types/proposalDoc'

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: '/fonts/OpenSans-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/OpenSans-Bold.ttf', fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback((word) => [word])

export const PILOTO_PDF_LAYOUT_REVISION = 1

const PAGE_W = 810
const PAGE_H = 1440
const MARGIN_X = 81
const GRAY = '#9B9B9B'
const DARK = '#0B0B0B'
const BLACK = '#000000'
const WHITE = '#FFFFFF'

const ABOUT_TEXT =
  'Um projeto de 45 dias dividido em duas fases: 15 dias montando a estrutura e 30 dias com anúncio no ar, medindo o que funciona.'

const FOUNDATION_SUMMARY = 'Montagem da estrutura completa antes de ligar o tráfego.'
const TRAFFIC_SUMMARY = 'Anúncio no ar com verba real e otimização contínua.'

const styles = StyleSheet.create({
  pageDark: {
    width: PAGE_W,
    height: PAGE_H,
    fontFamily: 'Open Sans',
    backgroundColor: DARK,
    color: WHITE,
    position: 'relative',
  },
  pageLight: {
    width: PAGE_W,
    height: PAGE_H,
    paddingTop: 81,
    paddingBottom: 100,
    paddingHorizontal: MARGIN_X,
    fontFamily: 'Open Sans',
    color: BLACK,
    backgroundColor: WHITE,
  },
  logoBox: {
    position: 'absolute',
    top: 81,
    left: MARGIN_X,
    width: 280,
    height: 72,
  },
  logoImage: {
    width: 280,
    height: 72,
    objectFit: 'contain',
    objectPosition: 'left center',
  },
  logoFallback: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 28,
    color: WHITE,
  },
  coverCenter: {
    position: 'absolute',
    left: MARGIN_X,
    right: MARGIN_X,
    bottom: 160,
  },
  accentBar: {
    width: 160,
    height: 4,
    marginBottom: 22,
  },
  coverTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 56,
    color: WHITE,
    lineHeight: 1.15,
  },
  coverLead: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 24,
    color: WHITE,
    marginTop: 16,
  },
  coverMeta: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 16,
    color: GRAY,
    marginTop: 10,
  },
  pageTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 32,
    color: BLACK,
    marginBottom: 28,
  },
  body: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 16,
    color: BLACK,
    lineHeight: 1.5,
  },
  muted: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: GRAY,
    lineHeight: 1.45,
  },
  phaseLabel: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 18,
    color: BLACK,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
  },
  itemTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: BLACK,
  },
  itemDesc: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 13,
    color: GRAY,
    marginTop: 4,
    lineHeight: 1.4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  planName: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 14,
    color: BLACK,
    width: 160,
  },
  planChannels: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 12,
    color: GRAY,
    flexGrow: 1,
  },
  planTotal: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 14,
    color: BLACK,
    fontVariant: 'tabular-nums',
  },
  step: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: BLACK,
    marginBottom: 8,
    lineHeight: 1.4,
  },
  closing: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: BLACK,
    marginTop: 18,
    lineHeight: 1.45,
  },
  professional: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 14,
    color: BLACK,
    marginTop: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: MARGIN_X,
    right: MARGIN_X,
  },
  footerText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 12,
    color: GRAY,
  },
  strike: {
    textDecoration: 'line-through',
  },
})

interface PilotoPdfDocumentProps {
  input: PilotoInput
  content: PilotoAiContent
}

function ItemList({
  items,
}: {
  items: { title: string; description: string }[]
}): ReactElement {
  return (
    <View>
      {items.map((item, index) => (
        <View key={item.title}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDesc}>{item.description}</Text>
        </View>
      ))}
    </View>
  )
}

export function PilotoPdfDocument({ input, content }: PilotoPdfDocumentProps): ReactElement {
  const accent = normalizeAccentColor(input.accentColor)
  const installments = calcInstallments(AGENCY_DEAL_CENTS, input.installmentFeeRate)
  const cityLine = input.leadCity.trim()
    ? `Projeto de 45 dias · ${input.leadCity.trim()}`
    : 'Projeto de 45 dias'
  const closing =
    content.closingParagraph.trim() || 'Fico à disposição para alinhar os próximos passos.'

  return (
    <Document>
      <Page size={[PAGE_W, PAGE_H]} style={styles.pageDark}>
        <View style={styles.logoBox}>
          {input.logoDataUrl ? (
            <Image src={input.logoDataUrl} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoFallback}>{input.companyName || 'WorkPRO'}</Text>
          )}
        </View>
        <View style={styles.coverCenter}>
          <View style={[styles.accentBar, { backgroundColor: accent }]} />
          <Text style={styles.coverTitle}>Piloto 45</Text>
          <Text style={styles.coverLead}>{input.leadCompanyName || 'Sem nome'}</Text>
          <Text style={styles.coverMeta}>{cityLine}</Text>
        </View>
      </Page>

      <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight}>
        <Text style={styles.pageTitle}>O que é</Text>
        <Text style={styles.body}>{ABOUT_TEXT}</Text>
        <View style={[styles.divider, { marginTop: 28 }]} />
        <Text style={styles.phaseLabel}>Dias 1 a 15 — Fundação</Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>{FOUNDATION_SUMMARY}</Text>
        <View style={styles.divider} />
        <Text style={styles.phaseLabel}>Dias 16 a 45 — Tráfego</Text>
        <Text style={[styles.muted, { marginTop: 6 }]}>{TRAFFIC_SUMMARY}</Text>
      </Page>

      <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight}>
        <Text style={styles.pageTitle}>Fundação (15 dias)</Text>
        <ItemList items={FOUNDATION_ITEMS} />
      </Page>

      <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight}>
        <Text style={styles.pageTitle}>Tráfego (30 dias)</Text>
        <ItemList items={TRAFFIC_ITEMS} />
        <Text style={[styles.muted, { marginTop: 28 }]}>{AD_BUDGET_NOTE}</Text>
      </Page>

      <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight}>
        <Text style={styles.pageTitle}>Investimento</Text>
        {PILOTO_PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planRow,
              plan.highlighted ? { backgroundColor: accent } : { backgroundColor: '#F5F5F5' },
            ]}
          >
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planChannels}>{plan.channels.join(' · ')}</Text>
            <Text style={styles.planTotal}>{formatCurrencyBRL(plan.totalCents)}</Text>
          </View>
        ))}

        <Text style={[styles.body, { marginTop: 20 }]}>
          Valor de agência:{' '}
          <Text style={styles.strike}>{formatCurrencyBRL(AGENCY_LIST_CENTS)}</Text>
          {' — '}
          condição de fechamento: {formatCurrencyBRL(AGENCY_DEAL_CENTS)}
        </Text>
        <Text style={[styles.body, { marginTop: 8 }]}>
          À vista no Pix {formatCurrencyBRL(AGENCY_DEAL_CENTS)} ou 10x de{' '}
          {formatCurrencyBRL(installments.installmentCents)} (total{' '}
          {formatCurrencyBRL(installments.totalCents)})
        </Text>

        <Text style={[styles.pageTitle, { marginTop: 32, marginBottom: 16, fontSize: 24 }]}>
          Próximos passos
        </Text>
        {NEXT_STEPS.map((step, index) => (
          <Text key={step} style={styles.step}>
            {index + 1}. {step}
          </Text>
        ))}
        <Text style={[styles.muted, { marginTop: 16 }]}>{RECURRENCE_NOTE}</Text>
        <Text style={styles.closing}>{closing}</Text>
        <Text style={styles.professional}>{input.professionalName}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {[input.websiteUrl.trim(), `Proposta válida por ${input.validityDays} dias`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

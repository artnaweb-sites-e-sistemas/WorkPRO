import {
  Document,
  Font,
  Image,
  Link,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  Defs,
  LinearGradient,
  Stop,
} from '@react-pdf/renderer'
import type { ProposalContentDoc, ProposalFormInput } from '../types/proposalDoc'
import { formatValidityLabel } from '../lib/proposalTerms'

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: '/fonts/OpenSans-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/OpenSans-Bold.ttf', fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback((word) => [word])

const PAGE_W = 810
const PAGE_H = 1440
const MARGIN_X = 81
const CONTENT_W = 648
const YELLOW = '#FFDE59'
const GRAY = '#9B9B9B'
const LIGHT_BG = '#E8E8E8'
/** Cor única do rodapé (linha + texto), com opacidade baixa */
const FOOTER_MUTED = '#9A9A9A'
const DARK = '#0B0B0B'
const BLACK = '#000000'

const styles = StyleSheet.create({
  pageDark: {
    width: PAGE_W,
    height: PAGE_H,
    fontFamily: 'Open Sans',
    color: BLACK,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  pageLight: {
    width: PAGE_W,
    paddingTop: 81,
    paddingBottom: 140,
    paddingHorizontal: MARGIN_X,
    fontFamily: 'Open Sans',
    color: BLACK,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  logoBox: {
    position: 'absolute',
    top: 81,
    left: MARGIN_X,
    width: 371,
    height: 99,
  },
  logoImage: {
    width: 371,
    height: 99,
    objectFit: 'contain',
    objectPosition: 'left center',
  },
  logoFallback: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 34,
    color: '#FFFFFF',
  },
  coverTop: {
    marginTop: 220,
    paddingHorizontal: MARGIN_X,
  },
  coverLabel: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 34,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  coverTagline: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    color: GRAY,
    letterSpacing: 0.8,
    marginTop: 10,
  },
  coverCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: MARGIN_X,
    paddingBottom: 40,
  },
  coverTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 51,
    color: '#FFFFFF',
    lineHeight: 1.25,
    maxWidth: CONTENT_W,
  },
  yellowBar: {
    width: 240,
    height: 4,
    backgroundColor: YELLOW,
    marginTop: 26,
  },
  coverSubtitle: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    color: GRAY,
    lineHeight: 1.45,
    marginTop: 26,
    maxWidth: 520,
  },
  footer: {
    position: 'absolute',
    bottom: 81,
    left: MARGIN_X,
    right: MARGIN_X,
  },
  footerWebsiteRow: {
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footerLine: {
    height: 1,
    backgroundColor: FOOTER_MUTED,
    opacity: 0.45,
  },
  footerLineDark: {
    height: 1,
    backgroundColor: GRAY,
    opacity: 1,
  },
  footerRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: FOOTER_MUTED,
    opacity: 0.45,
  },
  footerTextDark: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: GRAY,
    opacity: 1,
  },
  footerValidityAccent: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 14,
    color: YELLOW,
    opacity: 1,
  },
  watermark: {
    position: 'absolute',
    top: 300,
    right: -60,
    width: 420,
    opacity: 0.06,
    transform: 'rotate(-16deg)',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionBar: {
    width: 6,
    height: 26,
    backgroundColor: YELLOW,
  },
  sectionTitle: {
    marginLeft: 12,
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17.5,
    color: BLACK,
  },
  sectionBlock: {
    marginTop: 54,
  },
  aboutText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    lineHeight: 1.4,
    width: CONTENT_W,
  },
  includedCard: {
    backgroundColor: LIGHT_BG,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 26,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  includedText: {
    marginLeft: 14,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    lineHeight: 1.35,
    flex: 1,
  },
  includedDivider: {
    height: 1,
    backgroundColor: '#D4D4D4',
  },
  prerequisiteBlock: {
    marginTop: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4D4D4',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 26,
  },
  prerequisiteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: YELLOW,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  prerequisiteBadgeText: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    color: BLACK,
    letterSpacing: 0.4,
  },
  prerequisiteRow: {
    paddingVertical: 14,
  },
  prerequisiteItemText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    color: BLACK,
    lineHeight: 1.4,
  },
  prerequisiteDivider: {
    height: 1,
    backgroundColor: '#D4D4D4',
  },
  table: {
    borderWidth: 1.5,
    borderColor: BLACK,
    backgroundColor: '#FFFFFF',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: DARK,
    minHeight: 53,
  },
  tableHeaderCell: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1.5,
    borderTopColor: BLACK,
    backgroundColor: '#FFFFFF',
  },
  tableCell: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.4,
    color: BLACK,
  },
  tableCellStage: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.35,
    color: BLACK,
  },
  tableCellStageWrap: {
    borderRightWidth: 1.5,
    borderRightColor: BLACK,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  tableCellDescWrap: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  investmentBlock: {
    backgroundColor: DARK,
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  investmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  investmentLabel: {
    flex: 1,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 17,
    lineHeight: 1.35,
    color: '#FFFFFF',
    paddingRight: 16,
  },
  investmentValue: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 18,
    color: YELLOW,
    textAlign: 'right',
  },
  paymentBlock: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E2E2',
    paddingVertical: 22,
    paddingHorizontal: 24,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  paymentAccent: {
    width: 6,
    alignSelf: 'stretch',
    backgroundColor: YELLOW,
    marginRight: 14,
  },
  paymentContent: {
    flex: 1,
  },
  paymentLabel: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: DARK,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  paymentBody: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 18,
    lineHeight: 1.4,
    color: '#2A2A2A',
  },
  paymentBodyBold: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1.4,
    color: '#2A2A2A',
  },
  paymentDivider: {
    height: 1,
    backgroundColor: '#E2E2E2',
    marginVertical: 18,
  },
  investmentDivider: {
    height: 1.5,
    backgroundColor: '#3F3F46',
    marginVertical: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    color: YELLOW,
  },
  stepText: {
    marginLeft: 18,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    flex: 1,
  },
  closingTitle: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 42,
    color: '#FFFFFF',
  },
  closingParagraph: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    color: GRAY,
    lineHeight: 1.45,
    marginTop: 24,
    maxWidth: 520,
  },
  closingDivider: {
    width: 120,
    height: 2,
    backgroundColor: YELLOW,
    marginTop: 40,
  },
  closingName: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    color: YELLOW,
    marginTop: 20,
  },
})

function DarkBackground() {
  return (
    <Svg style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H }}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#171717" />
          <Stop offset="1" stopColor="#000000" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={PAGE_W} height={PAGE_H} fill="url(#bg)" />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" style={{ marginTop: 3 }}>
      <Path
        d="M4 12.5 L9.5 18 L20 6.5"
        stroke="#000000"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

function CoverLogo({
  logoDataUrl,
  companyName,
}: {
  logoDataUrl: string
  companyName: string
}) {
  return (
    <View style={styles.logoBox}>
      {logoDataUrl ? (
        <Image src={logoDataUrl} style={styles.logoImage} />
      ) : (
        <Text style={styles.logoFallback}>{companyName}</Text>
      )}
    </View>
  )
}

function formatMonthYear(date = new Date()): string {
  const raw = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  // "julho de 2026" → "Julho de 2026"
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Largura da coluna Etapa proporcional à maior palavra (+ padding). */
function stageColumnWidth(stages: string[]): number {
  const longest = stages.reduce((max, stage) => Math.max(max, stage.trim().length), 'Etapa'.length)
  // Open Sans Bold ~15px ≈ 8.6px/caractere; padding horizontal 14+14
  const textWidth = longest * 8.6
  const padding = 28
  const border = 1.5
  const minWidth = 96
  const maxWidth = Math.round(CONTENT_W * 0.42)
  return Math.min(maxWidth, Math.max(minWidth, Math.ceil(textWidth + padding + border)))
}

function formatWebsiteForPdf(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
}

function websiteHref(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

function FooterWebsiteLink({
  websiteUrl,
  textStyle,
}: {
  websiteUrl: string
  textStyle: typeof styles.footerText
}) {
  const label = formatWebsiteForPdf(websiteUrl)
  const href = websiteHref(websiteUrl)
  if (!label || !href) {
    return null
  }

  return (
    <View style={styles.footerWebsiteRow}>
      <Link src={href}>
        <Text style={textStyle}>{label}</Text>
      </Link>
    </View>
  )
}

function PageFooter({
  companyName,
  websiteUrl,
  validityDays,
  closing,
  tone = 'light',
}: {
  companyName: string
  websiteUrl?: string
  validityDays?: number
  /** Rodapé da última página: validade + mês/ano (sem nome da empresa) */
  closing?: boolean
  /** light = páginas brancas; dark = capa / fechamento */
  tone?: 'light' | 'dark'
}) {
  const lineStyle = tone === 'dark' ? styles.footerLineDark : styles.footerLine
  const textStyle = tone === 'dark' ? styles.footerTextDark : styles.footerText
  const hasWebsite = Boolean(websiteUrl?.trim())

  if (closing) {
    const days = validityDays != null && validityDays > 0 ? validityDays : 15
    return (
      <View style={styles.footer} fixed>
        {hasWebsite && websiteUrl ? (
          <FooterWebsiteLink websiteUrl={websiteUrl} textStyle={textStyle} />
        ) : null}
        <View style={lineStyle} />
        <View style={styles.footerRow}>
          <Text style={textStyle}>
            Proposta válida por{' '}
            <Text style={styles.footerValidityAccent}>{formatValidityLabel(days)}</Text> a partir
            da data de envio
          </Text>
          <Text style={textStyle}>{formatMonthYear()}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.footer} fixed>
      {hasWebsite && websiteUrl ? (
        <FooterWebsiteLink websiteUrl={websiteUrl} textStyle={textStyle} />
      ) : null}
      <View style={lineStyle} />
      <View style={styles.footerRow}>
        <Text style={textStyle}>{companyName}</Text>
        <Text style={textStyle}>{formatMonthYear()}</Text>
      </View>
    </View>
  )
}

/** Separa pagamento e recorrência (suporta nota antiga numa linha só). */
function splitPaymentNote(note: string): { paymentLine: string; recurrenceLine: string | null } {
  const byNewline = note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (byNewline.length > 1) {
    return {
      paymentLine: byNewline[0],
      recurrenceLine: byNewline.slice(1).join(' '),
    }
  }

  const marker = 'Recorrência '
  const index = note.indexOf(marker)
  if (index > 0) {
    return {
      paymentLine: note.slice(0, index).trim(),
      recurrenceLine: note.slice(index).trim(),
    }
  }

  return { paymentLine: note, recurrenceLine: null }
}

function formatRecurrenceBody(recurrenceLine: string): string {
  return recurrenceLine
    .replace(/^Recorrência\s+de\s+/i, '')
    .replace(/^Recorrência\s+/i, '')
    .trim()
}

/** Destaca %, valores R$ e trechos como "em 30 dias" / "/mês". */
const PAYMENT_BOLD_RE =
  /(\d+%|R\$\s*[\d.]+,\d{2}(?:\/mês|\s+por mês)?|em\s+\d+\s+dias|\d+x)/gi

function isPaymentBoldSegment(segment: string): boolean {
  return /^(?:\d+%|R\$\s*[\d.]+,\d{2}(?:\/mês|\s+por mês)?|em\s+\d+\s+dias|\d+x)$/i.test(
    segment.trim(),
  )
}

function RichPaymentText({ text }: { text: string }) {
  const parts = text.split(PAYMENT_BOLD_RE)

  return (
    <Text style={styles.paymentBody}>
      {parts.map((part, index) => {
        if (!part) {
          return null
        }

        return (
          <Text
            key={`${index}-${part.slice(0, 12)}`}
            style={isPaymentBoldSegment(part) ? styles.paymentBodyBold : undefined}
          >
            {part}
          </Text>
        )
      })}
    </Text>
  )
}

function PaymentTermsBlock({ paymentNote }: { paymentNote: string }) {
  const { paymentLine, recurrenceLine } = splitPaymentNote(paymentNote)

  return (
    <View style={styles.paymentBlock} wrap={false}>
      <View style={styles.paymentRow}>
        <View style={styles.paymentAccent} />
        <View style={styles.paymentContent}>
          <Text style={styles.paymentLabel}>Forma de pagamento</Text>
          <RichPaymentText text={paymentLine} />
        </View>
      </View>

      {recurrenceLine ? (
        <>
          <View style={styles.paymentDivider} />
          <View style={styles.paymentRow}>
            <View style={styles.paymentAccent} />
            <View style={styles.paymentContent}>
              <Text style={styles.paymentLabel}>Recorrência</Text>
              <RichPaymentText text={formatRecurrenceBody(recurrenceLine)} />
            </View>
          </View>
        </>
      ) : null}
    </View>
  )
}

function InvestmentBlock({
  rows,
}: {
  rows: { label: string; value: string }[]
}) {
  return (
    <View style={styles.investmentBlock} wrap={false}>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`}>
          {index > 0 ? <View style={styles.investmentDivider} /> : null}
          <View style={styles.investmentRow}>
            <View style={styles.paymentAccent} />
            <Text style={styles.investmentLabel}>{row.label}</Text>
            <Text style={styles.investmentValue}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

function CoverPage({ input, content }: { input: ProposalFormInput; content: ProposalContentDoc }) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={styles.pageDark}>
      <DarkBackground />
      <CoverLogo logoDataUrl={input.logoDataUrl} companyName={input.companyName} />

      <View style={styles.coverTop}>
        <Text style={styles.coverLabel}>PROPOSTA COMERCIAL</Text>
        <Text style={styles.coverTagline}>{input.tagline.toUpperCase()}</Text>
      </View>

      <View style={styles.coverCenter}>
        <Text style={styles.coverTitle}>{content.projectTitle}</Text>
        <View style={styles.yellowBar} />
        <Text style={styles.coverSubtitle}>{content.projectSubtitle}</Text>
      </View>

      <PageFooter companyName={input.companyName} websiteUrl={input.websiteUrl} tone="dark" />
    </Page>
  )
}

function ContentPages({
  input,
  content,
}: {
  input: ProposalFormInput
  content: ProposalContentDoc
}) {
  const stampSrc = input.markDataUrl

  return (
    <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight} wrap>
      {stampSrc ? <Image src={stampSrc} fixed style={styles.watermark} /> : null}

      <View>
        <SectionHeading title="Sobre a Empresa" />
        <Text style={styles.aboutText}>{content.aboutText}</Text>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="O que está incluso" />
        <View style={styles.includedCard} wrap={false}>
          {content.includedItems.map((item, index) => (
            <View key={`${item}-${index}`}>
              {index > 0 ? <View style={styles.includedDivider} /> : null}
              <View style={styles.includedRow}>
                <CheckIcon />
                <Text style={styles.includedText}>{item}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {content.prerequisiteBody ? (
        <View style={styles.prerequisiteBlock} wrap={false}>
          <View style={styles.prerequisiteBadge}>
            <Text style={styles.prerequisiteBadgeText}>PRÉ-REQUISITO DO PROJETO</Text>
          </View>
          {content.prerequisiteBody
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((item, index) => (
              <View key={`${item}-${index}`}>
                {index > 0 ? <View style={styles.prerequisiteDivider} /> : null}
                <View style={styles.prerequisiteRow}>
                  <Text style={styles.prerequisiteItemText}>{item}</Text>
                </View>
              </View>
            ))}
        </View>
      ) : null}

      <View style={styles.sectionBlock} wrap={false}>
        <SectionHeading title="Como funciona na prática" />
        {(() => {
          const stageWidth = stageColumnWidth(content.howItWorks.map((row) => row.stage))
          const descWidth = CONTENT_W - stageWidth

          return (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <View style={[styles.tableCellStageWrap, { width: stageWidth, backgroundColor: DARK }]}>
                  <Text style={styles.tableHeaderCell}>Etapa</Text>
                </View>
                <View style={[styles.tableCellDescWrap, { width: descWidth, backgroundColor: DARK }]}>
                  <Text style={styles.tableHeaderCell}>Descrição</Text>
                </View>
              </View>
              {content.howItWorks.map((row, index) => (
                <View key={`${row.stage}-${index}`} style={styles.tableRow}>
                  <View style={[styles.tableCellStageWrap, { width: stageWidth }]}>
                    <Text style={styles.tableCellStage}>{row.stage}</Text>
                  </View>
                  <View style={[styles.tableCellDescWrap, { width: descWidth }]}>
                    <Text style={styles.tableCell}>{row.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )
        })()}
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Investimento" />
        <InvestmentBlock rows={content.investmentRows} />
        <PaymentTermsBlock paymentNote={content.paymentNote} />
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Próximos passos" />
        {content.nextSteps.map((step, index) => (
          <View key={`${step}-${index}`} style={styles.stepRow} wrap={false}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <PageFooter companyName={input.companyName} websiteUrl={input.websiteUrl} />
    </Page>
  )
}

function ClosingPage({ input, content }: { input: ProposalFormInput; content: ProposalContentDoc }) {
  return (
    <Page size={[PAGE_W, PAGE_H]} style={styles.pageDark}>
      <DarkBackground />
      <CoverLogo logoDataUrl={input.logoDataUrl} companyName={input.companyName} />

      <View style={styles.coverTop}>
        <Text style={styles.coverLabel}>PROPOSTA COMERCIAL</Text>
        <Text style={styles.coverTagline}>{input.tagline.toUpperCase()}</Text>
      </View>

      <View style={styles.coverCenter}>
        <Text style={styles.closingTitle}>Vamos construir isso juntos.</Text>
        <Text style={styles.closingParagraph}>{content.closingParagraph}</Text>
        <View style={styles.closingDivider} />
        <Text style={styles.closingName}>{input.professionalName}</Text>
      </View>

      <PageFooter
        companyName={input.companyName}
        websiteUrl={input.websiteUrl}
        closing
        tone="dark"
        validityDays={input.validityDays > 0 ? input.validityDays : 15}
      />
    </Page>
  )
}

export function ProposalPdfDocument({
  input,
  content,
}: {
  input: ProposalFormInput
  content: ProposalContentDoc
}) {
  return (
    <Document>
      <CoverPage input={input} content={content} />
      <ContentPages input={input} content={content} />
      <ClosingPage input={input} content={content} />
    </Document>
  )
}

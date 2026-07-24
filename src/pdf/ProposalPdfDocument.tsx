import {
  Document,
  Font,
  Image,
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
const HAIRLINE = '#242424'
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
    paddingBottom: 81,
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
  footerLine: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
  footerRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    color: GRAY,
  },
  watermark: {
    position: 'absolute',
    top: -30,
    right: -70,
    width: 300,
    opacity: 0.07,
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
    maxWidth: 560,
  },
  includedCard: {
    backgroundColor: LIGHT_BG,
    borderRadius: 12,
    padding: 26,
  },
  includedRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  includedText: {
    marginLeft: 14,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    lineHeight: 1.35,
    flex: 1,
  },
  prerequisiteBlock: {
    marginTop: 54,
    backgroundColor: DARK,
    borderRadius: 14,
    padding: 30,
  },
  prerequisiteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: YELLOW,
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  prerequisiteBadgeText: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 17,
    color: BLACK,
    letterSpacing: 0.4,
  },
  prerequisiteBody: {
    marginTop: 22,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    color: '#FFFFFF',
    lineHeight: 1.4,
  },
  table: {
    borderWidth: 1.5,
    borderColor: BLACK,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: DARK,
    minHeight: 53,
  },
  tableHeaderCell: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 15,
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderTopColor: BLACK,
  },
  tableCell: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.4,
    color: BLACK,
  },
  colStage: {
    width: '22%',
    borderRightWidth: 1.5,
    borderRightColor: BLACK,
  },
  colDesc: {
    width: '78%',
  },
  colInvestLabel: {
    width: '70%',
    borderRightWidth: 1.5,
    borderRightColor: BLACK,
  },
  colInvestValue: {
    width: '30%',
  },
  paymentNote: {
    marginTop: 20,
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 19,
    lineHeight: 1.4,
  },
  paymentNoteBold: {
    fontFamily: 'Open Sans',
    fontWeight: 700,
    fontSize: 19,
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
  closingName: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 21,
    color: YELLOW,
    marginTop: 46,
  },
  validityYellow: {
    fontFamily: 'Open Sans',
    fontWeight: 400,
    fontSize: 15,
    color: YELLOW,
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

      <View style={styles.footer} fixed>
        <View style={styles.footerLine} />
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{input.companyName}</Text>
          <Text style={styles.footerText}>{formatMonthYear()}</Text>
        </View>
      </View>
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
  const watermarkSrc = input.markDataUrl || input.logoDataUrl

  return (
    <Page size={[PAGE_W, PAGE_H]} style={styles.pageLight} wrap>
      {watermarkSrc ? <Image src={watermarkSrc} fixed style={styles.watermark} /> : null}

      <View>
        <SectionHeading title="Sobre a Empresa" />
        <Text style={styles.aboutText}>{content.aboutText}</Text>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="O que está incluso" />
        <View style={styles.includedCard} wrap={false}>
          {content.includedItems.map((item, index) => (
            <View
              key={`${item}-${index}`}
              style={[
                styles.includedRow,
                index === content.includedItems.length - 1 ? { marginBottom: 0 } : {},
              ]}
            >
              <CheckIcon />
              <Text style={styles.includedText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {content.prerequisiteBody ? (
        <View style={styles.prerequisiteBlock} wrap={false}>
          <View style={styles.prerequisiteBadge}>
            <Text style={styles.prerequisiteBadgeText}>PRÉ-REQUISITO DO PROJETO</Text>
          </View>
          <Text style={styles.prerequisiteBody}>{content.prerequisiteBody}</Text>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionHeading title="Como funciona na prática" />
        <View style={styles.table} wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colStage]}>Etapa</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descrição</Text>
          </View>
          {content.howItWorks.map((row, index) => (
            <View key={`${row.stage}-${index}`} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colStage]}>{row.stage}</Text>
              <Text style={[styles.tableCell, styles.colDesc]}>{row.description}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeading title="Investimento" />
        <View style={styles.table} wrap={false}>
          {content.investmentRows.map((row, index) => (
            <View
              key={`${row.label}-${index}`}
              style={[styles.tableRow, index === 0 ? { borderTopWidth: 0 } : {}]}
            >
              <Text style={[styles.tableCell, styles.colInvestLabel]}>{row.label}</Text>
              <Text style={[styles.tableCell, styles.colInvestValue]}>{row.value}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.paymentNote}>
          <Text style={styles.paymentNoteBold}>Forma de pagamento sugerida</Text>
          {`: ${content.paymentNote}`}
        </Text>
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
        <Text style={styles.closingName}>{input.professionalName}</Text>
      </View>

      <View style={styles.footer} fixed>
        <View style={styles.footerLine} />
        <View style={[styles.footerRow, { justifyContent: 'flex-start' }]}>
          <Text style={styles.footerText}>
            Proposta válida por{' '}
            <Text style={styles.validityYellow}>
              {formatValidityLabel(input.validityDays > 0 ? input.validityDays : 15)}
            </Text>{' '}
            a partir da data de envio
          </Text>
        </View>
      </View>
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

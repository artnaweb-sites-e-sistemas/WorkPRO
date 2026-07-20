import { parseCurrencyBRL, formatCurrencyBRL } from './currencyBRL'
import {
  getMeetingScriptFixed,
  MEETING_SCRIPT_SECTION_TITLES,
} from './meetingScriptTemplate'
import { calculateWorkanaPricing } from './workanaFee'
import type { ConversationChannel } from '../types/models'
import type {
  MeetingScriptBlock,
  MeetingScriptDocument,
  MeetingScriptRun,
  MeetingScriptSection,
  MeetingScriptSlots,
} from '../types/meetingScript'

export const MEETING_VALUES_PLACEHOLDER = '[[VALORES]]'

function fixedBlock(text: string): MeetingScriptBlock {
  return { runs: [{ text, personalized: false }] }
}

function personalizedBlock(text: string): MeetingScriptBlock {
  return { runs: [{ text, personalized: true }] }
}

function buildGreetingBlock(
  clientName: string,
  fixed: ReturnType<typeof getMeetingScriptFixed>,
): MeetingScriptBlock {
  const name = clientName.trim()

  if (!name) {
    return fixedBlock(fixed.aberturaSemNome)
  }

  return {
    runs: [
      { text: fixed.aberturaComNomePrefix, personalized: false },
      { text: name, personalized: true },
      { text: fixed.aberturaComNomeSuffix, personalized: false },
    ],
  }
}

function buildAberturaPlanoBlock(
  aberturaResumo: string,
  fixed: ReturnType<typeof getMeetingScriptFixed>,
): MeetingScriptBlock {
  return {
    runs: [
      { text: fixed.aberturaPlanoPrefix, personalized: false },
      { text: aberturaResumo, personalized: true },
      { text: fixed.aberturaPlanoSuffix, personalized: false },
    ],
  }
}

function buildQuemSouBlock(
  area: string,
  fixed: ReturnType<typeof getMeetingScriptFixed>,
): MeetingScriptBlock {
  return {
    runs: [
      { text: fixed.quemSouPrefix, personalized: false },
      { text: area, personalized: true },
      { text: fixed.quemSouSuffix, personalized: false },
    ],
  }
}

function personalizedBlocks(paragraphs: string[]): MeetingScriptBlock[] {
  return paragraphs.map((text) => personalizedBlock(text))
}

function buildObjecaoBlock(label: string, resposta: string): MeetingScriptBlock {
  return {
    runs: [
      { text: label, personalized: true },
      { text: ' ', personalized: false },
      { text: resposta, personalized: false },
    ],
  }
}

function buildValuesMarkerBlock(): MeetingScriptBlock {
  return fixedBlock(MEETING_VALUES_PLACEHOLDER)
}

/** Monta o roteiro completo = template fixo + slots + marcador de valores. */
export function buildMeetingScriptFromSlots(
  slots: MeetingScriptSlots,
  clientName: string,
  channel: ConversationChannel = 'workana',
): MeetingScriptDocument {
  const fixed = getMeetingScriptFixed(channel)

  const sections: MeetingScriptSection[] = [
    {
      title: MEETING_SCRIPT_SECTION_TITLES.abertura,
      blocks: [
        buildGreetingBlock(clientName, fixed),
        buildAberturaPlanoBlock(slots.aberturaResumo, fixed),
        fixedBlock(fixed.aberturaConfirmacao),
      ],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.quemSou,
      blocks: [
        fixedBlock(fixed.quemSouGancho),
        buildQuemSouBlock(slots.area, fixed),
        fixedBlock(fixed.quemSouProvaSocial),
        personalizedBlock(slots.diferencial),
      ],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.diagnostico,
      blocks: [
        personalizedBlock(slots.diagnosticoContexto),
        ...slots.diagnosticoPerguntas.map((pergunta) => personalizedBlock(pergunta)),
      ],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.comoResolveria,
      blocks: [
        ...personalizedBlocks(slots.comoResolveria),
        fixedBlock(fixed.comoResolveriaPergunta),
      ],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.valorSeguranca,
      blocks: fixed.valorSeguranca.map((text) => fixedBlock(text)),
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.investimento,
      blocks: [
        personalizedBlock(slots.investimentoFraming),
        buildValuesMarkerBlock(),
        fixedBlock(fixed.investimentoCheckIn),
      ],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.proximosPassos,
      blocks: fixed.proximosPassos.map((text) => fixedBlock(text)),
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.fechamento,
      blocks: [fixedBlock(fixed.fechamento)],
    },
    {
      title: MEETING_SCRIPT_SECTION_TITLES.objecoes,
      blocks: fixed.objecoes.map(({ label, resposta }) => buildObjecaoBlock(label, resposta)),
    },
  ]

  return { sections }
}

export function isValuesMarkerBlock(block: MeetingScriptBlock): boolean {
  return (
    block.runs.length === 1 &&
    block.runs[0].text.trim() === MEETING_VALUES_PLACEHOLDER &&
    block.runs[0].personalized === false
  )
}

/** Runs da frase natural de valores (só números personalized:true). */
export function buildValuesRuns(
  suggestedPrice: string | null | undefined,
  suggestedRecurringPrice: string | null | undefined,
  isRecurring: boolean,
  channel: ConversationChannel = 'workana',
): MeetingScriptRun[] {
  const cents = suggestedPrice?.trim() ? parseCurrencyBRL(suggestedPrice) : 0
  const netReais = cents > 0 ? cents / 100 : 0

  if (netReais <= 0) {
    return [
      {
        text: 'Defina o preço no campo de Orçamento para exibir os valores.',
        personalized: false,
      },
    ]
  }

  const netFmt = formatCurrencyBRL(Math.round(netReais * 100))
  const runs: MeetingScriptRun[] =
    channel === 'whatsapp'
      ? [
          { text: 'O valor do serviço que proponho é de ', personalized: false },
          { text: netFmt, personalized: true },
          {
            text: ', com pagamento direto via Pix, sem comissão de plataforma.',
            personalized: false,
          },
        ]
      : (() => {
          const pricing = calculateWorkanaPricing(netReais)
          return [
            { text: 'O valor do serviço que proponho é de ', personalized: false },
            { text: pricing.netFmt, personalized: true },
            { text: '. A Workana tem uma comissão de 20%, que fica em ', personalized: false },
            { text: pricing.commissionFmt, personalized: true },
            {
              text: '. Com isso, o investimento total para colocar seu projeto no ar seria de ',
              personalized: false,
            },
            { text: pricing.totalFmt, personalized: true },
            { text: '.', personalized: false },
          ]
        })()

  const recurringCents = suggestedRecurringPrice?.trim()
    ? parseCurrencyBRL(suggestedRecurringPrice)
    : 0
  const recurringReais = recurringCents > 0 ? recurringCents / 100 : 0

  if (isRecurring && recurringReais > 0) {
    const recurringFmt =
      channel === 'whatsapp'
        ? `${formatCurrencyBRL(Math.round(recurringReais * 100))}/mês`
        : `${calculateWorkanaPricing(recurringReais).netFmt}/mês`
    runs.push(
      { text: ' Para manutenção regular, o valor seria de ', personalized: false },
      { text: recurringFmt, personalized: true },
      { text: '.', personalized: false },
    )
  }

  return runs
}

export function resolveMeetingScriptDocument(
  document: MeetingScriptDocument,
  suggestedPrice: string | null | undefined,
  suggestedRecurringPrice: string | null | undefined,
  isRecurring: boolean,
  channel: ConversationChannel = 'workana',
): MeetingScriptDocument {
  return {
    sections: document.sections.map((section) => ({
      title: section.title,
      blocks: section.blocks.flatMap((block) => {
        if (isValuesMarkerBlock(block)) {
          return [
            {
              runs: buildValuesRuns(
                suggestedPrice,
                suggestedRecurringPrice,
                isRecurring,
                channel,
              ),
            },
          ]
        }

        return [block]
      }),
    })),
  }
}

export function meetingScriptToPlainText(document: MeetingScriptDocument): string {
  return document.sections
    .map((section) => {
      const blocksText = section.blocks
        .map((block) => block.runs.map((run) => run.text).join(''))
        .join('\n\n')

      return blocksText ? `${section.title}\n\n${blocksText}` : section.title
    })
    .join('\n\n')
}

export function serializeMeetingScriptSlots(slots: MeetingScriptSlots): string {
  return JSON.stringify(slots)
}

function normalizeStringArray(
  value: unknown,
  minLength = 1,
  maxLength?: number,
): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)

  if (items.length < minLength) {
    return null
  }

  if (maxLength !== undefined && items.length > maxLength) {
    return null
  }

  return items
}

function normalizeDiferencial(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    const first = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .find((item) => item.length > 0)
    return first ?? null
  }

  return null
}

export function parseMeetingScriptSlots(raw: string): MeetingScriptSlots | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>

    if (Array.isArray(parsed.sections)) {
      return null
    }

    const area = typeof parsed.area === 'string' ? parsed.area.trim() : ''
    const aberturaResumo =
      typeof parsed.aberturaResumo === 'string' ? parsed.aberturaResumo.trim() : ''
    const diferencial = normalizeDiferencial(parsed.diferencial)
    const diagnosticoContexto =
      typeof parsed.diagnosticoContexto === 'string' ? parsed.diagnosticoContexto.trim() : ''
    const investimentoFraming =
      typeof parsed.investimentoFraming === 'string' ? parsed.investimentoFraming.trim() : ''
    const diagnosticoPerguntas = normalizeStringArray(parsed.diagnosticoPerguntas, 2)
    const comoResolveria = normalizeStringArray(parsed.comoResolveria, 2)

    if (
      !area ||
      !aberturaResumo ||
      !diferencial ||
      !diagnosticoContexto ||
      !investimentoFraming ||
      !diagnosticoPerguntas ||
      !comoResolveria
    ) {
      return null
    }

    return {
      area,
      aberturaResumo,
      diferencial,
      diagnosticoContexto,
      diagnosticoPerguntas,
      comoResolveria,
      investimentoFraming,
    }
  } catch {
    return null
  }
}

function normalizeRun(value: unknown): MeetingScriptRun | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text : ''
  const personalized = record.personalized === true

  if (!text) {
    return null
  }

  return { text, personalized }
}

function normalizeBlock(value: unknown): MeetingScriptBlock | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const runsRaw = (value as { runs?: unknown }).runs
  if (!Array.isArray(runsRaw)) {
    return null
  }

  const runs = runsRaw
    .map(normalizeRun)
    .filter((run): run is MeetingScriptRun => run !== null)

  if (runs.length === 0) {
    return null
  }

  return { runs }
}

function normalizeSection(value: unknown): MeetingScriptSection | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const record = value as Record<string, unknown>
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const blocksRaw = record.blocks

  if (!title || !Array.isArray(blocksRaw)) {
    return null
  }

  const blocks = blocksRaw
    .map(normalizeBlock)
    .filter((block): block is MeetingScriptBlock => block !== null)

  if (blocks.length === 0) {
    return null
  }

  return { title, blocks }
}

/** Formato legado (roteiro inteiro gerado pela IA). */
export function parseMeetingScriptJson(raw: string): MeetingScriptDocument | null {
  try {
    const parsed = JSON.parse(raw) as { sections?: unknown }
    if (!Array.isArray(parsed.sections)) {
      return null
    }

    const sections = parsed.sections
      .map(normalizeSection)
      .filter((section): section is MeetingScriptSection => section !== null)

    if (sections.length === 0) {
      return null
    }

    return { sections }
  } catch {
    return null
  }
}

export function resolveMeetingScriptForDisplay(
  raw: string,
  clientName: string,
  suggestedPrice: string | null | undefined,
  suggestedRecurringPrice: string | null | undefined,
  isRecurring: boolean,
  channel: ConversationChannel = 'workana',
): MeetingScriptDocument | null {
  const slots = parseMeetingScriptSlots(raw)
  if (slots) {
    return resolveMeetingScriptDocument(
      buildMeetingScriptFromSlots(slots, clientName, channel),
      suggestedPrice,
      suggestedRecurringPrice,
      isRecurring,
      channel,
    )
  }

  const legacy = parseMeetingScriptJson(raw)
  if (legacy) {
    return resolveMeetingScriptDocument(
      legacy,
      suggestedPrice,
      suggestedRecurringPrice,
      isRecurring,
      channel,
    )
  }

  return null
}

export function prepareMeetingScriptForCopy(
  raw: string,
  clientName: string,
  suggestedPrice: string | null | undefined,
  suggestedRecurringPrice: string | null | undefined,
  isRecurring: boolean,
  channel: ConversationChannel = 'workana',
): string {
  const document = resolveMeetingScriptForDisplay(
    raw,
    clientName,
    suggestedPrice,
    suggestedRecurringPrice,
    isRecurring,
    channel,
  )
  if (!document) {
    return ''
  }

  return meetingScriptToPlainText(document)
}

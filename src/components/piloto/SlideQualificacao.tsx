import {
  CHAT_HANDOFF,
  QUALIFICATION_COPY,
  QUALIFICATION_POINTS,
  TEMPERATURE_LANES,
  resolveChat,
} from '../../lib/pilotoContent'
import { BODY, CheckIcon, FAINT, INK, LightSlide, MUTED, RULE, SOFT, SignalBars } from './deck'
import type { SlideProps } from './slideTypes'

const PHONE_W = 316
const PHONE_H = 452
const LANE_CENTERS = [74, 226, 378]
const CONNECTOR_W = 52

/** O WhatsApp é o do lead: avatar com a inicial dele, nunca a marca da agência. */
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
    <div
      className="flex shrink-0 flex-col overflow-hidden bg-white"
      style={{ width: PHONE_W, height: PHONE_H, borderRadius: 30, border: `1.5px solid ${RULE}` }}
      aria-hidden
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-4" style={{ backgroundColor: SOFT }}>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-white"
          style={{ borderRadius: 999, border: `1px solid ${RULE}` }}
        >
          <span className="text-[14px] font-bold">{name.charAt(0).toUpperCase()}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{name}</p>
          <p className="text-[12px] font-medium" style={{ color: MUTED }}>
            online agora
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-3 pt-3.5" style={{ backgroundColor: '#FAFAFA' }}>
        {messages.map((message, index) =>
          message.from === 'lead' ? (
            <p
              key={index}
              className="max-w-[84%] self-start bg-white px-3 py-1.5 text-[13px] font-medium leading-[1.4]"
              style={{ border: `1px solid ${RULE}`, borderRadius: '4px 14px 14px 14px' }}
            >
              {message.text}
            </p>
          ) : (
            <div key={index} className="max-w-[90%] self-end">
              {index === 1 ? (
                <p className="mb-1 text-right text-[11px] font-semibold" style={{ color: MUTED }}>
                  Automação · respondeu em segundos
                </p>
              ) : null}
              <p
                className="px-3 py-1.5 text-[13px] font-medium leading-[1.4]"
                style={{ backgroundColor: `${accent}40`, borderRadius: '14px 4px 14px 14px' }}
              >
                {message.text}
              </p>
            </div>
          ),
        )}

        <div className="mt-auto flex justify-center pt-2">
          <span
            className="flex items-center gap-2 px-3.5 py-2 text-[12px] font-semibold text-white"
            style={{ backgroundColor: INK, borderRadius: 999 }}
          >
            <span className="h-2 w-2" style={{ backgroundColor: accent, borderRadius: 999 }} />
            {CHAT_HANDOFF}
          </span>
        </div>
      </div>
    </div>
  )
}

function Connector() {
  const startY = PHONE_H / 2
  return (
    <svg width={CONNECTOR_W} height={PHONE_H} viewBox={`0 0 ${CONNECTOR_W} ${PHONE_H}`} className="shrink-0" aria-hidden>
      {LANE_CENTERS.map((y, laneIndex) => (
        <path
          key={y}
          d={`M0,${startY} C${CONNECTOR_W * 0.55},${startY} ${CONNECTOR_W * 0.45},${y} ${CONNECTOR_W},${y}`}
          fill="none"
          stroke={laneIndex === 0 ? INK : FAINT}
          strokeWidth={laneIndex === 0 ? 2 : 1.25}
        />
      ))}
      <circle cx={2} cy={startY} r={3.5} fill={INK} />
    </svg>
  )
}

export function SlideQualificacao({ input, content, accent, index, total }: SlideProps) {
  const businessName = input.leadCompanyName.trim() || 'Seu negócio'
  const messages = resolveChat(content.chatMessages ?? [])

  return (
    <LightSlide
      input={input}
      accent={accent}
      index={index}
      total={total}
      kicker="Atendimento com automação"
      title="Nenhuma conversa se perde"
    >
      <div className="flex h-full items-center gap-10">
        <div className="w-[320px] shrink-0">
          <p className="text-[19px] font-medium leading-[1.5]" style={{ color: BODY }}>
            {QUALIFICATION_COPY}
          </p>
          <ul className="mt-7 space-y-3">
            {QUALIFICATION_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-[16px] font-semibold">
                <CheckIcon size={17} />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 items-center" style={{ height: PHONE_H }}>
          <PhoneMock accent={accent} name={businessName} messages={messages} />
          <Connector />
          <div className="relative flex-1" style={{ height: PHONE_H }}>
            {TEMPERATURE_LANES.map((lane, laneIndex) => (
              <div
                key={lane.name}
                className="absolute left-0 right-0 -translate-y-1/2 pl-4"
                style={{ top: LANE_CENTERS[laneIndex] }}
              >
                <div className="flex items-center gap-3">
                  <SignalBars level={lane.level} />
                  <span className="text-[20px] font-bold tracking-[-0.01em]">{lane.name}</span>
                </div>
                <p className="mt-1 pl-[27px] text-[15px] font-medium leading-[1.4]" style={{ color: BODY }}>
                  {lane.action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LightSlide>
  )
}

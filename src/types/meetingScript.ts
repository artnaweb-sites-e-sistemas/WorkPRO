/** Encaixes personalizados gerados pela IA — persistidos no Firestore. */
export interface MeetingScriptSlots {
  area: string
  aberturaResumo: string
  diferencial: string
  diagnosticoContexto: string
  diagnosticoPerguntas: string[]
  comoResolveria: string[]
  investimentoFraming: string
}

export interface MeetingScriptRun {
  text: string
  personalized: boolean
}

export interface MeetingScriptBlock {
  runs: MeetingScriptRun[]
}

export interface MeetingScriptSection {
  title: string
  blocks: MeetingScriptBlock[]
}

export interface MeetingScriptDocument {
  sections: MeetingScriptSection[]
}

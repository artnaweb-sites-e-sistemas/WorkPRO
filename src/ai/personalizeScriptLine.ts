import { SchemaType } from '@google/generative-ai'
import { getGeminiModel } from '../lib/ai'

const SYSTEM_INSTRUCTION = `Você reescreve UMA fala de um roteiro de reunião de vendas para ela soar feita sob medida para o cliente, usando o que ele respondeu antes.

Quem fala é o vendedor, em português do Brasil, conversando por vídeo com o dono de um negócio local.

REGRAS:
- Cumpra o OBJETIVO da fala. Se a fala genérica tem UMA pergunta, a sua tem exatamente UMA pergunta. Não acrescente perguntas.
- As respostas do cliente são anotações rápidas do vendedor, não frases prontas. NUNCA cole a anotação do jeito que está se ela não couber na gramática: reescreva a ideia com as palavras do cliente para a frase ficar correta.
  Ex.: objetivo "sair do operacional" numa fala sobre nada mudar vira "você continuar preso no operacional", nunca "como fica sair do operacional".
  Ex.: problema "você fica chateado" vira "você ficar chateado" ou "essa chateação", conforme a frase pedir.
- Clareza antes de tudo: a pergunta tem que ser entendida de primeira, ouvida uma vez só. Sujeito e verbo simples, sem encadear "o que te levou a trazer X por Y". Prefira a frase mais curta que cumpra o objetivo.
- Não comece com o nome do cliente (a fala anterior do roteiro normalmente já usa).
- Tom de conversa falada: frases curtas, simples, nada de jargão de marketing (lead, funil, conversão, tráfego).
- MÁXIMO 30 palavras.
- Antes de responder, leia a frase em voz alta mentalmente: se algum trecho soar estranho ou sem concordância, reescreva.
- Nunca prometa resultado, número, prazo ou valor que não esteja na fala genérica.
- MARCAÇÃO: quando a fala usar uma resposta do cliente, marque o trecho que veio dela assim {{chave|trecho}}, com a chave que aparece ao lado da resposta. Ex.: {{hoje|as indicações}}. Marque só esse trecho, uma vez por resposta usada. Nome do cliente e empresa não são marcados.
- Nunca use dois-pontos. Em conversa falada eles soam como leitura: troque por ponto, vírgula ou uma pergunta.
- Sem aspas, sem emoji, sem markdown.`

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: { text: { type: SchemaType.STRING } },
  required: ['text'],
}

/** Devolve a fala personalizada, ou string vazia em qualquer falha (aí vale a genérica). */
export async function personalizeScriptLine(params: {
  brief: string
  generic: string
  answers: { key?: string; label: string; value: string }[]
  company: string
  name: string
}): Promise<string> {
  const prompt = [
    `OBJETIVO DA FALA: ${params.brief}`,
    `FALA GENÉRICA: ${params.generic}`,
    params.name ? `NOME DO CLIENTE: ${params.name}` : '',
    params.company ? `EMPRESA: ${params.company}` : '',
    'O QUE O CLIENTE RESPONDEU:',
    ...params.answers.map((answer) => `- ${answer.label}${answer.key ? ` (chave ${answer.key})` : ''}: ${answer.value}`),
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const model = getGeminiModel(SYSTEM_INSTRUCTION, SCHEMA)
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as { text?: unknown }
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
    // Passou muito do limite = fugiu da regra; fica a genérica.
    return text.replace(/\{\{\w+\|([^}]*)\}\}/g, '$1').split(/\s+/).length > 40 ? '' : text
  } catch (error) {
    console.error('[personalizeScriptLine]', error)
    return ''
  }
}

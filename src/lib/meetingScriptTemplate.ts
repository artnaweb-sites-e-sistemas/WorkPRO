/** Texto fixo do roteiro de reunião — edite aqui para alterar o script em todos os roteiros. */

import type { ConversationChannel } from '../types/models'

export const MEETING_SCRIPT_FIXED = {
  aberturaSemNome:
    'Olá, tudo bem? Que bom poder falar com você, e valeu por reservar esse tempo hoje.',
  aberturaComNomePrefix: 'Olá ',
  aberturaComNomeSuffix:
    ', tudo bem? Que bom poder falar com você, e valeu por reservar esse tempo hoje.',
  aberturaPlanoPrefix: 'A minha ideia é a gente conversar sobre ',
  aberturaPlanoSuffix:
    ', eu entender melhor o que você precisa, te mostrar como posso ajudar e a gente já alinha os próximos passos.',
  aberturaConfirmacao: 'Combinado?',

  quemSouGancho:
    'Antes de entrar no seu projeto, deixa eu me apresentar rapidinho pra você me conhecer um pouco.',
  quemSouPrefix: 'Sou o Bira, da Artnaweb, e trabalho com ',
  quemSouSuffix: ' desde 2015.',
  quemSouProvaSocial:
    'Já são mais de 100 projetos entregues aqui na Workana, todos com nota máxima.',

  comoResolveriaPergunta: 'Começar assim faz sentido pra você?',

  valorSeguranca: [
    'O que eu quero é te entregar um trabalho de qualidade, pra você não ter retrabalho nem surpresa lá na frente.',
    'E pra eu já pensar numa solução que caiba no seu momento, você tem uma faixa de valor em mente pra esse projeto?',
    'Perfeito... deixa eu te mostrar o que dá pra fazer com isso.',
  ],

  investimentoCheckIn: 'Esse investimento está dentro do que você tinha em mente?',

  proximosPassos: [
    'Sobre como seguir, tenho duas formas e pra mim é indiferente, então fica do jeito que for melhor pra você.',
    'Pela Workana é tudo pela plataforma, mas ela cobra uns 20% de taxa em cima.',
    'Por isso muita gente prefere fechar direto comigo, sem essa taxa: aí você paga só o valor do serviço, 50% pra começar e 50% na entrega.',
    'Qual dos dois fica melhor pra você?',
  ],

  fechamento:
    'Podemos fechar então pra já garantir seu lugar na agenda e começar?',

  objecoes: [
    {
      label: '(Se achar o preço alto)',
      resposta:
        'Entendo. Esse valor é pra fazer bem feito de uma vez... e sair barato agora costuma custar caro depois, com retrabalho. Prefiro te entregar certo desde o começo.',
    },
    {
      label: '(Se disser que vai pensar)',
      resposta:
        'Claro. Só pra eu te ajudar a decidir: tem alguma dúvida que, se eu resolver agora, já te deixaria tranquilo pra seguir?',
    },
    {
      label: '(Se disser que achou mais barato)',
      resposta:
        'É comum ter valores diferentes por aí... a diferença costuma estar na entrega. Onde a outra proposta te pareceu melhor?',
    },
    {
      label: '(Se achar o prazo longo)',
      resposta:
        'Esse prazo é pra entregar redondo, sem correria que vira problema depois. Tem alguma data que é importante pra você bater?',
    },
  ],
} as const

const MEETING_SCRIPT_FIXED_WHATSAPP = {
  ...MEETING_SCRIPT_FIXED,
  quemSouProvaSocial: 'Já são mais de 100 projetos entregues, todos com satisfação máxima dos clientes.',
  proximosPassos: [
    'Daqui pra frente é bem tranquilo: a gente combina os detalhes, eu envio a proposta e, com o Pix confirmado, já começamos pelo briefing.',
    'Eu costumo pegar poucos projetos por vez pra conseguir entregar com qualidade... então, se fizer sentido pra você, quanto antes a gente alinhar, mais fácil eu garanto seu lugar.',
    'Antes disso, ficou alguma dúvida ou algo que você queira alinhar direto comigo?',
  ],
  fechamento:
    'Podemos combinar o pagamento via Pix e já garantir seu lugar na agenda pra iniciarmos com o briefing?',
} as const

export function getMeetingScriptFixed(channel: ConversationChannel) {
  return channel === 'whatsapp' ? MEETING_SCRIPT_FIXED_WHATSAPP : MEETING_SCRIPT_FIXED
}

export const MEETING_SCRIPT_SECTION_TITLES = {
  abertura: '1. ABERTURA',
  quemSou: '2. QUEM SOU / AUTORIDADE',
  diagnostico: '3. DIAGNÓSTICO',
  comoResolveria: '4. COMO EU RESOLVERIA',
  valorSeguranca: '5. VALOR E SEGURANÇA',
  investimento: '6. INVESTIMENTO',
  proximosPassos: '7. PRÓXIMOS PASSOS',
  fechamento: '8. FECHAMENTO',
  objecoes: '9. QUEBRA DE OBJEÇÕES',
} as const

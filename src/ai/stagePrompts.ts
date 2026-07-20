import type { Stage } from '../types/models'

export interface StagePromptContext {
  clientName: string
  relationshipCount: number
  videoCallEnabled: boolean
  induceQuote: boolean
  hasSuggestedPrice: boolean
  isRecurring: boolean
}

const INDUCE_QUOTE_HOOK_REF = `GANCHO PARA ORÇAMENTO (obrigatório nesta mensagem):
A pergunta final deve conduzir o lead com naturalidade em direção ao preço/investimento — induzindo-o a perguntar sobre valor ou orçamento — SEM citar número, faixa de preço nem valor em reais.
Respeite a REGRA CENTRAL: não pergunte o que o lead já respondeu no histórico.
Exemplos de direção (só se ainda não foi dito): "vocês já têm uma ideia do que querem investir nisso?", "vocês querem colocar isso no ar pra quando?", "faz sentido eu te passar uma estimativa de investimento pra esse escopo?".
O gancho deve soar como continuação natural da conversa, não como venda forçada.`

const PERGUNTA_FINAL_REF =
  'A pergunta final segue a REGRA CENTRAL do BASE_IDENTITY: leia descrição e histórico, identifique o que o cliente JÁ disse, NÃO repita o óbvio, abra informação NOVA e ÚTIL, tom leve e certeiro. Parágrafo isolado, linha em branco (\\n\\n) antes.'

const NAO_RECAPITULAR_REF = `NÃO RECAPITULAR / REAFIRMAR O QUE O CLIENTE DISSE (regra forte):
Ao responder, use reconhecimento CURTO e vá DIRETO ao ponto. É PROIBIDO recapitular, confirmar ou reafirmar em resumo o que o cliente acabou de dizer.
Reconhecimentos curtos permitidos: "Perfeito, {nome}...", "Show, entendi...", "Boa...", "Que ótimo..." — mas SEM repetir/parafrasear a informação que o cliente deu.

EXEMPLO ERRADO (recapitula):
"Perfeito, Tuane! Começar com essas duas funcionalidades juntas é totalmente possível e forma uma base bem sólida para a plataforma. Para essa primeira fase, sem a integração com Open Finance, como você imagina a entrada de dados para o diagnóstico e o score de saúde?"
EXEMPLO CERTO:
"Perfeito, Tuane... Para essa primeira fase, sem a integração com Open Finance, como você imagina a entrada de dados para o diagnóstico e o score de saúde?"

EXEMPLO ERRADO (recapitula):
"Show, entendi que a marca d'água será aplicada manualmente para proteger também as imagens do Instagram. Pra gente alinhar rapidinho os detalhes do projeto, posso te enviar um convite pra conversarmos por voz em uns minutinhos agora?"
EXEMPLO CERTO:
"Show, Christian, entendi... Pra gente alinhar rapidinho os detalhes do projeto, posso te enviar um convite pra conversarmos por voz em uns minutinhos agora?"

AUTOVERIFICAÇÃO: antes de finalizar, se a primeira frase estiver reafirmando/resumindo o que o cliente disse, CORTE e deixe só o reconhecimento curto.`

function buildNomeClienteRef(clientName: string): string {
  const name = clientName.trim()

  if (!name) {
    return 'NOME DO CLIENTE: não cadastrado — não force uso de nome.'
  }

  return `NOME DO CLIENTE: use "${name}" com naturalidade e boa frequência (principalmente no reconhecimento curto, ex: "Perfeito, ${name}...", "Show, ${name}..."). Não em toda mensagem de forma robótica, mas com frequência humana.`
}

function chatToneRefs(ctx: StagePromptContext): string {
  return `${NAO_RECAPITULAR_REF}\n${buildNomeClienteRef(ctx.clientName)}`
}

const SEM_SAUDACAO_REF =
  'NÃO abra com "Olá [nome], tudo bem?" nem cumprimente de novo — a conversa já está em andamento. Entre direto no assunto ou use reconhecimento curto ("Perfeito...", "Show...").'

const PERGUNTA_OBRIGATORIA_REF =
  'Termine OBRIGATORIAMENTE com uma pergunta (a mensagem não pode acabar sem pergunta).'

const CALL_AGORA_RULES = `REGRAS DA CHAMADA (obrigatórias):
- INDUZIR a chamada AGORA (imediata), NÃO agendar para depois. Propor enviar o convite / conversar já.
- BAIXO COMPROMISSO: deixar claro que é rápido ("rapidinho", "uns minutinhos", "uns minutos") para reduzir resistência.
- ASSUMIR o agora e pedir só a permissão de enviar o convite/chamar.
- Exemplos de direção (não copiar literal): "Pra facilitar, posso te enviar um convite pra gente conversar rapidinho por voz agora?" ou "Pra gente alinhar rapidinho todos os pontos, posso te enviar um convite pra conversarmos por voz em uns minutinhos agora?".
- PROIBIDO abrir espaço para adiamento: NÃO perguntar "quando fica melhor pra você?", "que dia/horário prefere?", nem sugerir "amanhã", "semana que vem", "outro dia". Nada que convide o lead a empurrar pra frente.`

const CALL_CONVITE_INTEGRADO = `FORMATO DO CONVITE E PARÁGRAFOS (obrigatório):
- Dividir a mensagem em parágrafos CURTOS separados por LINHA EM BRANCO (\\n\\n). Nada grudado num bloco só.
- O convite para a call fica em parágrafo PRÓPRIO: é a própria pergunta, terminando com "?", e é a ÚLTIMA frase da mensagem.
- PROIBIDO juntar contexto e convite no mesmo parágrafo. PROIBIDO parágrafo extra com pergunta redundante depois do convite (nada de repetir "Posso te enviar o convite?" após o convite).

EXEMPLO — NÃO FAZER (tudo grudado + pergunta redundante):
"Pra gente alinhar rapidinho todos os pontos, eu posso te enviar um convite para conversarmos por voz em uns minutinhos agora.

Posso te enviar o convite?"

EXEMPLO — FAZER (contexto e convite em parágrafos separados; convite é a pergunta no último):
"Olá, tudo bem?

Que bacana o projeto do e-commerce monoproduto pra cascatas de piscina! Tenho bastante experiência com sites assim, focados em rapidez e conversão.

Pra gente alinhar rapidinho os pontos, posso te enviar um convite pra conversarmos por voz em uns minutinhos agora?"`

export function getStageInstruction(stage: Stage, ctx: StagePromptContext): string {
  switch (stage) {
    case 'abordagem':
      if (ctx.videoCallEnabled) {
        return `Gere a PRIMEIRA mensagem para iniciar a conversa com o lead. A abordagem JÁ CONVIDA para uma chamada por voz/vídeo AGORA. Estrutura EXATA em 3 parágrafos (linha em branco \\n\\n entre cada um):

PARÁGRAFO 1 — SAUDAÇÃO:
"Olá [nome], tudo bem?" (se não houver nome: "Olá, tudo bem?").

PARÁGRAFO 2 — CONTEXTO/INTERESSE (parágrafo curto, separado):
Interesse genuíno no projeto + experiência no TIPO de trabalho (ex: automação, sites, sistemas) — sem inventar nicho, clientes ou números. Tom leve, sem consultoria de graça, sem explicar benefícios óbvios.

PARÁGRAFO 3 — CONVITE-PERGUNTA (parágrafo próprio, separado):
O convite para chamada AGORA já em forma de pergunta, terminando com "?" — é a ÚLTIMA frase da mensagem.

${CALL_AGORA_RULES}

${CALL_CONVITE_INTEGRADO}

PROIBIDO:
- NÃO emendar explicação do benefício óbvio ("economiza tempo", "deixa a operação mais leve", etc.).
- NÃO inventar credenciais, casos ou experiência de nicho.
- NÃO grudar saudação, contexto e convite no mesmo parágrafo.
- NÃO adicionar parágrafo extra com outra pergunta depois do convite. Proibido "Fico à disposição", "Fico no aguardo", "Qualquer coisa me avisa", "Abraço".
Mantenha o estilo: sem negrito, sem travessão, reticências quando couber.
${buildNomeClienteRef(ctx.clientName)}`
      }

      return `Gere a PRIMEIRA mensagem para iniciar a conversa com o lead. Estrutura EXATA em 3 partes:

PARTE 1 — SAUDAÇÃO:
"Olá [nome], tudo bem?" (se não houver nome: "Olá, tudo bem?").

PARTE 2 — LINHA DE ALINHAMENTO (encorpada, porém enxuta: 1 a 2 linhas):
Deve conter, nesta ordem e de forma natural/fluida:
a) mostrar em UMA frase que entendeu o projeto (SEM repetir a descrição inteira do cliente);
b) demonstrar INTERESSE genuíno no projeto;
c) mencionar EXPERIÊNCIA no TIPO de trabalho (ex: automação, desenvolvimento de sites/sistemas).
E PARAR AÍ.

PROIBIDO nesta linha (regra crítica):
- NÃO emendar nenhuma explicação do BENEFÍCIO ÓBVIO da solução. O cliente já sabe o que quer; explicar isso soa como "encher linguiça" e fica artificial.
- Exemplos do que NÃO escrever: "que economiza tempo", "que deixa a operação mais leve", "que tira a tarefa repetitiva da frente", "para melhorar a produtividade", etc.

Regra de HONESTIDADE: a experiência mencionada é no TIPO de trabalho, NUNCA no nicho/segmento específico do cliente, e NUNCA inventar clientes, casos ou números.

EXEMPLO DE REFERÊNCIA (projeto: automação para responder comentários e mensagens — não copiar literal):
FAZER:
"Olá Lucas, tudo bem?

Vi que você quer automatizar as respostas de comentários e mensagens, e é bem o tipo de trabalho que eu gosto de fazer... trabalho bastante com automações assim.

Vocês já têm algum tipo de regra ou material de base que usam hoje pra responder?"

NÃO FAZER (explica benefício óbvio no fim da linha de alinhamento):
"...trabalho bastante com automações assim, que tiram a tarefa repetitiva da frente e deixam a operação mais leve." (CORTAR sempre esse tipo de frase.)

PARTE 3 — PERGUNTA CERTEIRA (parágrafo isolado, linha em branco \\n\\n antes):
${PERGUNTA_FINAL_REF}

- NÃO adicionar frase de encerramento depois da pergunta. Proibido "Fico à disposição", "Fico no aguardo", "Qualquer coisa me avisa", "Abraço". A mensagem termina exatamente na pergunta.
Mantenha o estilo: sem negrito, sem travessão, reticências quando couber, linha em branco entre parágrafos.
${buildNomeClienteRef(ctx.clientName)}
${PERGUNTA_OBRIGATORIA_REF}`

    case 'relacionamento': {
      let instruction = `Você está na etapa de RELACIONAMENTO. Gere uma resposta curta de chat (2 a 4 frases), enxuta e direta. NÃO repita a descrição do projeto. Responda ao que o cliente disse aplicando as regras de desconto/portfólio quando fizer sentido (sem inventar credenciais).
Quebre em parágrafos curtos com linha em branco (\\n\\n) entre eles — nada de bloco único longo.
${SEM_SAUDACAO_REF}
${chatToneRefs(ctx)}
${PERGUNTA_FINAL_REF}`

      if (ctx.induceQuote) {
        instruction += `\n\n${INDUCE_QUOTE_HOOK_REF}`
      }

      instruction += `\n${PERGUNTA_OBRIGATORIA_REF}`

      return instruction
    }

    case 'videocall':
      return `Gere uma mensagem curta e natural para a etapa de VÍDEO/VOZ CHAMADA. Esta etapa pode vir logo após a abordagem (quando a primeira mensagem já convidou para call) — leia o histórico antes de escrever.

Objetivo: puxar a chamada AGORA. Se o lead ainda não confirmou, reforce o convite imediato — sem abrir brecha para adiar.

Estrutura em 2 parágrafos (linha em branco \\n\\n entre eles):
- Parágrafo 1: reconhecimento curto e/ou contexto breve (resposta ao que o cliente disse).
- Parágrafo 2: convite para call AGORA já em forma de pergunta, terminando com "?" — última frase da mensagem.

${CALL_AGORA_RULES}

${CALL_CONVITE_INTEGRADO}

Enxuta, sem repetir o escopo do projeto. Tom leve e humano, sem inventar credenciais.
${SEM_SAUDACAO_REF}
${chatToneRefs(ctx)}
PROIBIDO grudar contexto e convite no mesmo parágrafo. PROIBIDO parágrafo extra com outra pergunta depois do convite.`

    case 'orcamento': {
      const recurringParagraph = ctx.isRecurring
        ? `3) Valor (R$) do serviço + prazo/cronograma estimado. Inclua também o valor mensal de manutenção no texto do orçamento. Use o valor recorrente já definido no contexto se existir; senão sugira um valor mensal coerente e preencha suggestedRecurringPrice no JSON (formato "R$ 997,00").`
        : `3) Valor (R$) + prazo/cronograma estimado. Sugira preço coerente com o escopo coletado. NÃO mencionar manutenção mensal, mensalidade nem valor recorrente. suggestedRecurringPrice no JSON = null sempre.`

      return `Gere a PROPOSTA/ORÇAMENTO em EXATAMENTE 4 parágrafos equilibrados, cada um com cerca de 2 a 3 linhas (~150 a 200 caracteres) — nada de parágrafos gigantes. Linha em branco entre parágrafos. Sem negrito, sem travessão, use reticências quando couber. Tom direto, conciso, sem reexplicar o projeto inteiro.

${SEM_SAUDACAO_REF} Entre direto na proposta.

Estrutura dos 4 parágrafos:
1) Alinhamento breve com o objetivo (1 linha, sem repetir a descrição do cliente).
2) O que será entregue, condensado: escopo principal, foco em resultado. Sem inventar experiência de nicho. PROIBIDO "rabinhos" explicativos ou enfeites (ex: "entregando um vídeo profissional e sem retrabalhos", "que transmita a essência da jornada" quando forem só justificativa óbvia).
${recurringParagraph}
4) Fecho CURTO (1 a 2 linhas) terminando com UMA pergunta leve de check-in (parágrafo isolado, linha em branco \\n\\n antes). Ex de direção: "faz sentido pra você?", "esse prazo funciona pra você?" — específica ao contexto quando couber.

PROIBIDO fechamentos passivos/fracos: "Fico à disposição", "qualquer dúvida", "fico no aguardo", "Fico no aguardo do seu retorno" ou equivalentes. A mensagem termina EXATAMENTE na pergunta de check-in, sem nada depois dela.

O cliente ainda NÃO aceitou. NÃO usar frases que assumem o fechamento — proibido "vou formalizar a proposta", "vou dar sequência" ou equivalentes nesta etapa.
${NAO_RECAPITULAR_REF}
${buildNomeClienteRef(ctx.clientName)}
${PERGUNTA_OBRIGATORIA_REF}`
    }

    case 'fechamento':
      return `Você está na etapa de FECHAMENTO. O cliente já recebeu o orçamento e pode ter dúvidas ou objeções (preço, prazo, confiança, comparação). Leia a mensagem dele e responda de forma curta e natural, enxuta, quebrando a objeção específica: reforce valor, qualidade que evita retrabalho, segurança na entrega quando fizer sentido — SEM inventar clientes, avaliações ou experiência de nicho. Mensagem curta, 2 a 4 frases.
Quebre em parágrafos curtos com linha em branco (\\n\\n) entre eles — nada de bloco único longo.
${SEM_SAUDACAO_REF}
${chatToneRefs(ctx)}
${PERGUNTA_FINAL_REF}
A pergunta final deve ajudar a destravar a objeção específica do lead (ex: se ele hesita no prazo, pergunte algo concreto sobre prioridade ou data; se hesita no valor, algo sobre o que é essencial manter no escopo) — nunca genérica. Pode conduzir ao fechamento com naturalidade (ex: "posso já formalizar a proposta aqui pra gente começar?") se couber no contexto.
${PERGUNTA_OBRIGATORIA_REF}`

    default:
      return ''
  }
}

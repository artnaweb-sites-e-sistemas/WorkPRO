# WorkPRO Cold call (extensão do Chrome)

Mostra no Google Maps e na aba Locais do Google quem você já ligou, com a cor do resultado,
e manda a empresa para o Cold call do WorkPRO com um clique.

## Instalar

1. No Chrome, abra `chrome://extensions`.
2. Ligue o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha esta pasta (`extensao-workpro`).
4. Fixe o ícone na barra (quebra-cabeça → alfinete).

Se o WorkPRO não estiver em `http://localhost:5173`, abra o popup da extensão, troque o
endereço e clique em **Salvar**.

Depois de instalar ou trocar o endereço, **recarregue a aba do WorkPRO** e abra o Cold call uma
vez: é ele que manda o histórico para a extensão.

## Como funciona

- **Painel da empresa** (Maps ou busca): aparece uma barra com o status da última ligação e o
  botão **Enviar para o Cold call** (ou **Abrir no Cold call**, se já ligou).
- **Listas**: as empresas que já receberam ligação ganham uma faixa na cor do status.
  - Azul: não atendeu ou pediu para ligar de novo.
  - Verde: reunião marcada.
  - Vermelho: não quis.
  - Cinza: ligação que ficou pela metade.
- O reconhecimento é pelo telefone (últimos 8 dígitos) ou pelo nome da empresa, ignorando
  acento e maiúsculas. É o mesmo critério do aviso de empresa repetida no WorkPRO.

Nada passa por servidor: o resumo do histórico fica guardado no próprio Chrome.

## Depois de atualizar os arquivos

Em `chrome://extensions`, clique no ícone de recarregar da extensão e recarregue as abas do
Google e do WorkPRO.

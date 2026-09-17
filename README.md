# Chamaqui — Portal de Chamados

Portal de chamados de TI com autenticação por dispositivo (código curto / QR Code) e suporte multi-organização.

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind CSS 4
- **Prisma 7** + PostgreSQL (Supabase)
- **JWT (jose)** para access/device tokens, **AES-256-GCM** para refresh tokens em repouso
- Sem next-auth — autenticação própria por ativação de dispositivo

## Fluxo de autenticação

1. Na tela `/login` o usuário informa o código curto (`XXXX-XXXX`, uso único, expira em 30 dias) ou escaneia o QR Code. **A organização é identificada pelo código**: a lista de clientes nunca é exibida nem exposta por API.
2. A tela mostra a organização e a permissão do código para confirmação, e só então o dispositivo é ativado.
   Consultas e ativações com código inexistente contam para o limite de tentativas (5 falhas por cliente bloqueiam por 5 minutos, via `AUTH_RATE_LIMIT_SECRET`; sem essa variável o limite fica desligado e o motivo vai para o log).
3. O dispositivo recebe: **access token** (15 min), **refresh token** (30 dias, criptografado em repouso) e **device token** (180 dias).
4. O refresh token sofre **rotação a cada uso** (o antigo é revogado).
5. **Revogação centralizada**: admins podem revogar dispositivos em `/settings/devices`; a revogação é verificada a cada acesso.
6. **Device binding**: cada dispositivo é vinculado a um fingerprint (userAgent + plataforma + ID de cliente). Sessões em devices revogados são invalidadas na hora.

## Primeiro acesso (bootstrap)

Para o primeiro login não é preciso ser admin antes: na tela `/login`, use "Sou responsável pela organização" e informe apenas a **chave de acesso** da organização (`ORG_ACCESS_KEY_<SLUG>` ou as variáveis legadas `HDL_ACCESS_KEY`/`INSTITUTO_ENERGISA_ACCESS_KEY`) — a organização é descoberta pela chave, que por isso deve ser única entre organizações (chave repetida é recusada e registrada no log). O sistema gera um código de ativação de uso único (válido 24h; administrador para a HDL, solicitante para as demais), que já leva à confirmação e ativação do dispositivo. Depois disso, os demais códigos são gerados em **Configurações → Códigos de Ativação**.

## Grade de Chamados

Modelo contratual de sustentação com três eixos independentes. A fonte única de
verdade é [`src/server/domain/ticket-grid.ts`](src/server/domain/ticket-grid.ts):
alterar a grade (prazos, tetos, faixas) é alterar esse arquivo.

| Eixo | Responde | Serve para |
| --- | --- | --- |
| Natureza (C1–C6) | que tipo de trabalho é? | quem paga e o que tem teto |
| Severidade (P1–P4) | o que está parado? | SLA de resposta e solução |
| Esforço (horas) | quanto custa atender? | converter chamado em capacidade |

**Categorias.** C1 incidente/correção (garantia, sem teto), C2 operação de
conteúdo (teto por item), C3 suporte (por atendimento), C4 ajuste evolutivo (por
chamado, até 8 h), C5 evolutivo estruturante (fora do contrato), C6 plataforma
(por evento). O teto se aplica só ao eixo de natureza; severidade nunca tem teto.

**SLA.** Só se aplica a C1. Os prazos correm em **horas úteis** (9h–18h, dias
úteis, com calendário de feriados) — ver
[`business-hours.ts`](src/server/services/business-hours.ts). Quando a correção
exige publicação (`correctionClass = CLIENTE`), a janela entre o envio e a
aprovação na Google Play é **descontada** do prazo de correção definitiva: não é
controlável pelo fornecedor. O compromisso controlável é o contorno.

**Tetos.** Cada organização tem um `SupportContract` com uma faixa (Essencial 40
h/mês, Padrão 80, Ampliado 160). Os tetos vêm da faixa e podem ser sobrepostos
por contrato em `ContractQuota`. Ajustes pontuais de uma competência (antecipação
de até 20% do mês seguinte, zeramento por rajada de P1) ficam em
`QuotaAdjustment`.

**Regras de contagem.** Uma demanda é atômica: doze estabelecimentos são doze
itens de C2, não um chamado. Reabertura em até 15 dias corridos não consome teto
novo. Improcedente e duplicado não consomem teto. C4 acima de 8 h bloqueia o
fechamento e exige reclassificação para C5 com aceite formal. A contagem de SLA
começa no registro no sistema, não na mensagem avulsa.

**Automações.** 80% do teto notifica gestor e cliente; 100% bloqueia o início da
execução até o cliente escolher entre excedente e fila do mês seguinte; 2 P1
simultâneos alertam o gestor; o 3º P1 na mesma semana zera os tetos de C2/C3/C4
do mês. Contestação de categoria expira sozinha em 5 dias úteis.

**Relatório mensal** em `/reports/consumption`: consumo × teto por categoria, SLA
cumprido por severidade (com e sem a janela de loja descontada), improcedentes,
reincidências, taxa de P1 contra a reserva da faixa e ranking de causa raiz.

> ⚠️ O seed popula apenas os feriados **nacionais** (fixos e móveis, derivados da
> Páscoa). Os feriados **municipais** de Cataguases, Itamarati de Minas e
> Leopoldina/Piacatuba precisam ser cadastrados na tabela `Holiday` antes da
> primeira apuração real — sem eles o relógio de SLA conta como útil um dia que
> não é.

## Auxílio de escrita com IA

Na abertura do chamado, o campo **Descrição detalhada** tem uma ação opcional
**✨ Melhorar com IA**: o solicitante relata o problema do jeito que sabe e
recebe uma versão revisada — ortografia, clareza e organização —, que só entra
no campo se ele aceitar. Recusar, falhar ou demorar não altera o que ele
escreveu, e depois de aplicada a sugestão o texto original continua a um clique.

A instrução enviada ao modelo é explícita em **melhorar o texto existente**: não
inventar fatos, causas ou informações técnicas, não remover informação
relevante e não mexer em classificações ou conclusões do relato — ver
[`writing-assistant.ts`](src/server/services/writing-assistant.ts).

O provedor é a Groq, pela API compatível com o formato OpenAI, configurada em
`GROQ_API_KEY` (e, opcionalmente, `GROQ_MODEL`). **Sem a chave o recurso
simplesmente não é oferecido** e a abertura de chamado segue idêntica: o auxílio
nunca é caminho obrigatório.

## Database setup

Para um banco novo/limpo, aplique o schema e os dados iniciais:

```bash
npm install
npx prisma migrate deploy
npm run seed
```

Alternativa sem CLI: executar `prisma/supabase-init.sql` no editor SQL do
Supabase e **depois** rodar `npm run seed`. Esse arquivo aplica apenas o schema
— os dados vêm sempre de `prisma/seed.ts`, para não existirem duas fontes de
verdade divergentes.

Ele é gerado a partir do schema, não editado à mão:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

O seed cria organizações, categorias, o contrato de sustentação e os feriados
nacionais. Para anexos, crie também o bucket **`tickets`** no Supabase Storage.

O fluxo de login também auto-provê as organizações no primeiro acesso; categorias são inseridas apenas pelo seed/script init.

## Scripts

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # prisma generate + next build
npm run start    # servidor de produção
npm run lint     # eslint
npm run seed     # seed inicial (organizações, categorias)
```

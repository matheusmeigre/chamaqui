# Chamaqui — Portal de Chamados

Portal de chamados de TI com autenticação por dispositivo (código curto / QR Code) e suporte multi-organização.

## Stack

- **Next.js 16** (App Router) + React 19 + Tailwind CSS 4
- **Prisma 7** + PostgreSQL (Supabase)
- **JWT (jose)** para access/device tokens, **AES-256-GCM** para refresh tokens em repouso
- Sem next-auth — autenticação própria por ativação de dispositivo

## Getting Started

Configure o ambiente:

```bash
cp .env.example .env
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Variáveis de servidor (não prefixar com `NEXT_PUBLIC_`):

```dotenv
DATABASE_URL="postgres://..."
DIRECT_URL="postgres://..."

# Autenticação por dispositivo
AUTH_TOKEN_SECRET="use-a-unique-random-secret"     # ≥16 chars; assina access e device tokens
TOKEN_ENCRYPTION_KEY="hex:<64 hex chars>"           # 32 bytes; encripta refresh tokens em repouso
AUTH_FINGERPRINT_SECRET="use-another-random-secret" # ≥16 chars; HMAC do fingerprint do dispositivo

# Legados (mantidos por compatibilidade)
NEXTAUTH_SECRET="use-an-independent-secret"
AUTH_RATE_LIMIT_SECRET="use-a-third-random-secret"
INSTITUTO_ENERGISA_ACCESS_KEY="use-a-unique-random-key"
HDL_ACCESS_KEY="use-a-different-unique-random-key"

# Chaves de acesso das organizações (bootstrap)
# Convenção: ORG_ACCESS_KEY_<SLUG> (traços viram underscore, tudo maiúsculo)
ORG_ACCESS_KEY_HDL="use-a-unique-random-key"
ORG_ACCESS_KEY_INSTITUTO_ENERGISA="use-a-different-unique-random-key"

NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

## Fluxo de autenticação

1. O usuário escolhe a organização na tela `/login`.
2. Um código curto (`XXXX-XXXX`, uso único, expira em 30 dias) ou QR Code ativa o dispositivo.
3. O dispositivo recebe: **access token** (15 min), **refresh token** (30 dias, criptografado em repouso) e **device token** (180 dias).
4. O refresh token sofre **rotação a cada uso** (o antigo é revogado).
5. **Revogação centralizada**: admins podem revogar dispositivos em `/settings/devices`; a revogação é verificada a cada acesso.
6. **Device binding**: cada dispositivo é vinculado a um fingerprint (userAgent + plataforma + ID de cliente). Sessões em devices revogados são invalidadas na hora.

## Primeiro acesso (bootstrap)

Para o primeiro login não é preciso ser admin antes: na tela `/login`, use "Sou responsável pela organização — gerar código de acesso" e informe a **chave de acesso** da organização (`ORG_ACCESS_KEY_<SLUG>` ou as variáveis legadas `HDL_ACCESS_KEY`/`INSTITUTO_ENERGISA_ACCESS_KEY`). O sistema gera um código de ativação de administrador de uso único (válido 24h), com o qual o dispositivo é ativado. Depois disso, os demais códigos são gerados em **Configurações → Códigos de Ativação**.

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

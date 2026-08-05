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

## Database setup

Para um banco novo/limpo, aplique o schema e os dados iniciais:

```bash
npm install
npx prisma migrate deploy
npm run seed
```

Alternativa: executar `prisma/supabase-init.sql` no editor SQL do Supabase.

O fluxo de login também auto-provê as organizações no primeiro acesso; categorias são inseridas apenas pelo seed/script init.

## Scripts

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # prisma generate + next build
npm run start    # servidor de produção
npm run lint     # eslint
npm run seed     # seed inicial (organizações, categorias)
```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Authentication environment variables

Configure these server-side variables for each Vercel environment. Do not prefix them with `NEXT_PUBLIC_`:

```dotenv
INSTITUTO_ENERGISA_ACCESS_KEY="use-a-unique-random-key"
HDL_ACCESS_KEY="use-a-different-unique-random-key"
AUTH_RATE_LIMIT_SECRET="use-a-third-random-secret"
NEXTAUTH_SECRET="use-an-independent-nextauth-secret"
```

The database stores only the organization identities and login throttling state. Access keys and client IP addresses are never persisted. After five invalid attempts for the same organization and client, access is blocked for five minutes.

### Database setup

For a brand new/clean database, apply the full schema and the initial data. There are two equivalent options:

**Option A — Prisma Migrate (recommended)**

```bash
npm install
npx prisma migrate deploy
npm run seed
```

**Option B — SQL script (Supabase SQL editor)**

Run the complete, idempotent script `prisma/supabase-init.sql` in the Supabase SQL editor. It creates the full schema, the two organization identities and the base categories. The seed above becomes optional.

After either option, configure the environment variables listed above and start the app.

The login itself also self-provisions the organization identities on first successful login, so the application works even if the seed was not executed (categories, however, are only inserted by the seed/init script).

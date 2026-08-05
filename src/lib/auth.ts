import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  clearFailedLogins,
  getClientHash,
  isLoginBlocked,
  registerFailedLogin,
} from "@/lib/auth-throttle";

const organizations = {
  instituto_energisa: {
    keyEnvironmentVariable: "INSTITUTO_ENERGISA_ACCESS_KEY",
    email: "instituto.energisa@chamaqui.local",
    name: "Instituto Energisa",
    role: "SOLICITANTE" as const,
  },
  hdl: {
    keyEnvironmentVariable: "HDL_ACCESS_KEY",
    email: "hdl@chamaqui.local",
    name: "HDL",
    role: "ADMINISTRADOR" as const,
  },
};

type OrganizationId = keyof typeof organizations;

function isOrganizationId(value: string): value is OrganizationId {
  return value in organizations;
}

function keysMatch(providedKey: string, expectedKey: string) {
  const providedDigest = createHash("sha256").update(providedKey).digest();
  const expectedDigest = createHash("sha256").update(expectedKey).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        organization: { label: "Organização", type: "text" },
        accessKey: { label: "Chave de acesso", type: "password" },
      },
      async authorize(credentials, request) {
        const organization = credentials?.organization ?? "";
        const accessKey = credentials?.accessKey ?? "";

        if (!isOrganizationId(organization) || !accessKey || accessKey.length > 256) {
          return null;
        }

        const clientHash = getClientHash(request.headers ?? {});
        if (await isLoginBlocked(organization, clientHash)) {
          throw new Error("LOGIN_BLOCKED");
        }

        const config = organizations[organization];
        const expectedKey = process.env[config.keyEnvironmentVariable];

        if (!expectedKey || !keysMatch(accessKey, expectedKey)) {
          const blockedUntil = await registerFailedLogin(organization, clientHash);
          if (blockedUntil) throw new Error("LOGIN_BLOCKED");
          return null;
        }

        const user = await prisma.user.upsert({
          where: { email: config.email },
          update: { name: config.name, role: config.role },
          create: { email: config.email, name: config.name, role: config.role },
        });

        await clearFailedLogins(organization, clientHash);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
        };
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt"
  },
  secret: process.env.NEXTAUTH_SECRET,
};

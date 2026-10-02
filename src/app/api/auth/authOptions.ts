// src/auth/authOptions.ts

import MyPrismaClient from "../../../../prisma/prismaClient";
import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcrypt";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(MyPrismaClient),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "john@doe.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const user = await MyPrismaClient.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("ไม่พบผู้ใช้งาน");
        }

        if (!user.emailVerified) {
          throw new Error("กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ");
        }

        if (user && (await bcrypt.compare(credentials.password, user.password || ""))) {
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          };
        } else {
          throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const id = user?.id ?? token.id;
      const dbUser = id
        ? await MyPrismaClient.user.findUnique({ where: { id } })
        : token.email
          ? await MyPrismaClient.user.findUnique({ where: { email: token.email } })
          : null;
      if (!dbUser) return { ...token, id: undefined, role: undefined };
      return { ...token, id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role };
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
};

import { getServerSession } from "next-auth/next";
import { NextRequest } from "next/server";
import { authOptions } from "../api/auth/authOptions";

export async function isAdmin(_req?: NextRequest) {
  const session = await getServerSession(authOptions);
  return session?.user?.role === "ADMIN";
}

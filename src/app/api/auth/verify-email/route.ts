import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return safeJson({ error: "โทเค็นไม่ถูกต้อง" }, { status: 400 });
  }

  // ตรวจสอบโทเค็นในฐานข้อมูล
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.expires <= new Date()) {
    return safeJson({ error: "โทเค็นหมดอายุหรือไม่ถูกต้อง" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  // ดึงค่า NEXTAUTH_URL จาก environment variable
  const redirectUrl = `${process.env.NEXTAUTH_URL}/email-verification-success`;

  // Redirect ไปยังหน้าสำเร็จการยืนยันอีเมล
  return NextResponse.redirect(redirectUrl);
}

export const dynamic = "force-dynamic";

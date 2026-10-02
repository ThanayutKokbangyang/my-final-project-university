import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// ฟังก์ชันสำหรับจัดการคำขอ GET
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return safeJson({ error: "Missing or invalid email" }, { status: 400 });
  }

  try {
    // ค้นหาผู้ใช้ตาม email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return safeJson({ error: "User not found" }, { status: 404 });
    }

    // ส่งสถานะการยืนยันอีเมลกลับไป
    return safeJson({ emailVerified: !!user.emailVerified }, { status: 200 });
  } catch (error) {
    console.error("Error checking email verification:", error);
    return safeJson({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

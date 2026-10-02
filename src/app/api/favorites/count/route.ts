import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../auth/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return safeJson({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  try {
    // นับจำนวนสินค้าที่ถูกกดหัวใจโดย user นี้
    const favoriteCount = await prisma.favorite.count({
      where: {
        userId,
      },
    });

    return safeJson({ favoriteCount });
  } catch (error) {
    console.error("Failed to get favorite count:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export const dynamic = "force-dynamic";

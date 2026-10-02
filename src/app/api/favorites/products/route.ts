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
    // ดึงรายการสินค้าที่อยู่ใน favorites ของผู้ใช้
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
      },
      include: {
        product: { include: { Inventory: true } }, // ดึงข้อมูลสินค้าที่เกี่ยวข้อง
      },
    });

    const favoriteProducts = favorites.map((favorite) => ({
      ...favorite.product,
      isFavorite: true,
    }));

    return safeJson(favoriteProducts); // ส่งคืนข้อมูลสินค้าใน favorites
  } catch (error) {
    console.error("Failed to fetch favorite products:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
// /api/cart/count.ts
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
    const cartItemCount = await prisma.cart.count({
      where: { userId },
    });

    return safeJson({ count: cartItemCount });
  } catch (error) {
    console.error("Failed to retrieve cart item count:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

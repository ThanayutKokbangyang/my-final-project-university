import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../auth/authOptions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Get the session using getServerSession without passing the request
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return safeJson({ message: "Unauthorized" }, { status: 401 });
    }

    // Extract userId from the session
    const userId = (session.user as { id: string }).id;

    // Extract productId from the URL query
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    // Check if productId is provided and is a valid number
    const parsedProductId = productId ? parseInt(productId, 10) : null;
    if (!parsedProductId || isNaN(parsedProductId)) {
      return safeJson({ message: "Valid product ID is required" }, { status: 400 });
    }

    // Find favorite using productId and userId
    const favorite = await prisma.favorite.findUnique({
      where: {
        productId_userId: {
          productId: parsedProductId,
          userId,
        },
      },
    });

    // Respond based on whether the product is a favorite
    return safeJson({ isFavorite: !!favorite }, { status: 200 });
  } catch (error) {
    console.error("Failed to check favorite status:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  } finally {
    // Ensure Prisma Client is disconnected after use
    await prisma.$disconnect();
  }
}

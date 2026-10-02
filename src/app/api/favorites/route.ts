import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../auth/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return safeJson({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { productId }: { productId?: string | number } = await req.json();
  const parsedProductId: number | undefined =
    typeof productId === "string" ? parseInt(productId, 10) : productId;

  if (!parsedProductId) {
    return safeJson(
      { message: "Product ID is required and must be a valid number" },
      { status: 400 },
    );
  }

  try {
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        productId_userId: {
          productId: parsedProductId,
          userId,
        },
      },
    });

    if (existingFavorite) {
      return safeJson({ message: "Product is already in favorites" }, { status: 400 });
    }

    const newFavorite = await prisma.favorite.create({
      data: {
        productId: parsedProductId,
        userId,
      },
    });

    return safeJson({ message: "Product added to favorites", favorite: newFavorite });
  } catch (error) {
    console.error("Failed to handle adding to favorites:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return safeJson({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { productId }: { productId?: string | number } = await req.json();
  const parsedProductId: number | undefined =
    typeof productId === "string" ? parseInt(productId, 10) : productId;

  if (!parsedProductId) {
    return safeJson(
      { message: "Product ID is required and must be a valid number" },
      { status: 400 },
    );
  }

  try {
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        productId_userId: {
          productId: parsedProductId,
          userId,
        },
      },
    });

    if (!existingFavorite) {
      return safeJson({ message: "Product not found in favorites" }, { status: 404 });
    }

    await prisma.favorite.delete({
      where: {
        productId_userId: {
          productId: parsedProductId,
          userId,
        },
      },
    });

    return safeJson({ message: "Product removed from favorites" });
  } catch (error) {
    console.error("Failed to handle removing from favorites:", error);
    return safeJson({ message: "Internal server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

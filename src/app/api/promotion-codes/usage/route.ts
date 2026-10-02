import { safeJson } from "@/lib/json";
import { requireUser, errorResponse } from "@/lib/http";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
  try {
    const { id: userId } = await requireUser();
    const { code } = await req.json();

    // Ensure promotion code and user ID are provided
    if (!code || !userId) {
      return safeJson({ error: "Promotion code and user ID are required." }, { status: 400 });
    }

    // Find the promotion code in the database
    const promotion = await prisma.promotionCode.findUnique({
      where: { code },
    });

    // If no promotion is found, return an error
    if (!promotion) {
      return safeJson({ error: "Invalid promotion code." }, { status: 404 });
    }

    const currentTime = new Date();

    // Check if the promotion code is active
    if (currentTime < promotion.startDate) {
      return safeJson({ error: "Promotion code is not yet valid." }, { status: 400 });
    } else if (currentTime > promotion.endDate) {
      return safeJson({ error: "Promotion code has expired." }, { status: 400 });
    }

    // Check if the user has already used this promotion code
    const existingUsage = await prisma.promotionUsage.findUnique({
      where: {
        promotionCodeId_userId: {
          promotionCodeId: promotion.id,
          userId: userId,
        },
      },
    });

    if (existingUsage) {
      return safeJson({
        message: "Promotion code has already been used by this user.",
        used: true,
      });
    }

    // If the code has not been used, return this information
    return safeJson({
      message: "Promotion code has not been used by this user.",
      used: false,
    });
  } catch (error) {
    console.error("Failed to check promotion code usage:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

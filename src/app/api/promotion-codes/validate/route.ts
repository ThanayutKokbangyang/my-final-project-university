import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
  try {
    const { code } = await req.json();

    // Check if the code was provided
    if (!code) {
      return safeJson({ error: "Promotion code is required." }, { status: 400 });
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
    if (promotion.status !== "ACTIVE" || currentTime < promotion.startDate) {
      return safeJson({ error: "Promotion code is not yet valid." }, { status: 400 });
    } else if (currentTime > promotion.endDate) {
      return safeJson({ error: "Promotion code has expired." }, { status: 400 });
    }

    // If valid, return the discount percentage
    return safeJson({
      discountPercentage: promotion.discountPercentage,
      message: "Promotion code applied successfully.",
    });
  } catch (error) {
    console.error("Failed to validate promotion code:", error);
    return safeJson({ error: "Failed to validate promotion code." }, { status: 500 });
  }
};

export const dynamic = "force-dynamic";

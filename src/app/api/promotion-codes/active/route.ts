import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

export const GET = async (req: NextRequest) => {
  try {
    // Retrieve only active promotion codes
    const activePromotionCodes = await prisma.promotionCode.findMany({
      where: {
        status: "ACTIVE",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    return safeJson(activePromotionCodes, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch active promotion codes:", error);
    return safeJson({ error: "Failed to fetch promotion codes." }, { status: 500 });
  }
};

export const dynamic = "force-dynamic";

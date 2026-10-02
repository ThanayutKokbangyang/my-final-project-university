import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    if (!query) {
      return safeJson([], { status: 200 });
    }

    // Convert the query to lowercase
    const lowercaseQuery = query.toLowerCase();

    // Fetch products and convert titles to lowercase for comparison
    const suggestions = await prisma.product.findMany({
      where: {
        title: {
          contains: lowercaseQuery, // Search using the lowercase query
        },
      },
      select: {
        id: true,
        title: true,
      },
      take: 5, // Limit to top 5 suggestions
    });

    return safeJson(suggestions, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return safeJson({ error: "Failed to fetch suggestions." }, { status: 500 });
  }
};

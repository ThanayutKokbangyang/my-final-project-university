import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../auth/authOptions";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);

  // Check if the user is authenticated
  if (!session?.user?.id) {
    return safeJson({ message: "Unauthorized" }, { status: 401 });
  }

  const loggedInUserId = (session.user as { id: string }).id;

  // Ensure the requested userId matches the logged-in user's id
  if (loggedInUserId !== params.userId) {
    return safeJson({ message: "Forbidden" }, { status: 403 });
  }

  try {
    // Find orders for the user, sorted by creation date, and return only the latest one
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (
      !orderId ||
      !/^\d+$/.test(orderId) ||
      !Number.isSafeInteger(Number(orderId)) ||
      Number(orderId) <= 0
    ) {
      return safeJson({ message: "Valid order ID is required" }, { status: 400 });
    }
    const orders = await prisma.order.findMany({
      where: { userId: loggedInUserId, id: Number(orderId) },
      include: {
        orderItems: {
          include: {
            product: true,
            inventory: {
              select: { size: true },
            },
          },
        },
        promotionCode: true,
      },
      orderBy: {
        createdAt: "desc", // Assumes you have a 'createdAt' field for sorting
      },
      take: 1, // Limits the result to only the latest order
    });

    if (orders.length === 0) {
      return safeJson({ message: "Order not found" }, { status: 404 });
    }

    // Format the latest order for display
    const formattedOrder = {
      ...orders[0],
      totalAmount: orders[0].totalAmount.toNumber(),
      orderItems: orders[0].orderItems.map((item) => ({
        ...item,
        price: item.price.toNumber(),
      })),
    };

    return safeJson(formattedOrder);
  } catch (error) {
    console.error("Error fetching order:", error);
    return safeJson({ message: "Error fetching order" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

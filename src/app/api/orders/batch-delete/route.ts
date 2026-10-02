import { errorResponse, HttpError, positiveIds } from "@/lib/http";
import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../../util/isAdmin";

// ... (GET and PATCH methods remain unchanged)

// DELETE: Batch remove orders by IDs
export const DELETE = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { ids } = await req.json();

    // Validate input
    if (!Array.isArray(ids) || ids.length === 0) {
      return safeJson({ error: "Order IDs are required." }, { status: 400 });
    }

    positiveIds(ids);
    if (await prisma.order.count({ where: { id: { in: ids }, stockReserved: true } })) {
      throw new HttpError(409, "Cancel or expire the active checkout before deleting this order");
    }
    const deletedOrders = await prisma.order.deleteMany({
      where: {
        id: {
          in: ids, // Delete all orders where ID is in the array
        },
      },
    });

    return safeJson({ deletedCount: deletedOrders.count }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete orders:", error);
    return errorResponse(error);
  }
};

// ... (Any other methods like PATCH, GET remain unchanged)

export const dynamic = "force-dynamic";

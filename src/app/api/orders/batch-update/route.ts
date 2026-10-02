import { safeJson } from "@/lib/json";
import { orderUserSelect } from "@/lib/users";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { isAdmin } from "../../../util/isAdmin";

// GET: Fetch orders with optional filters
export const GET = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "";
    const status = searchParams.get("status") || "";

    const orders = await prisma.order.findMany({
      where: {
        ...(orderId && { id: Number(orderId) }),
        ...(paymentStatus && { paymentStatus }), // Example of payment status filter
        ...(status && { status: status as OrderStatus }),
      },
      include: {
        user: { select: orderUserSelect },
        orderItems: {
          include: {
            product: true,
            inventory: true,
          },
        },
      },
    });

    return safeJson(orders, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return safeJson({ error: "Failed to fetch orders." }, { status: 500 });
  }
};

// PATCH: Batch update order statuses
export const PATCH = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { ids, status } = await req.json();
    // Log incoming data

    // Validate the input
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      console.error("Validation error: Missing IDs or status");
      return safeJson({ error: "Order IDs and status are required." }, { status: 400 });
    }

    // Ensure the status is valid
    const validStatuses = ["PENDING", "SHIPPED", "TRANSIT", "DELIVERED"];
    if (!validStatuses.includes(status)) {
      console.error("Validation error: Invalid status");
      return safeJson({ error: "Invalid order status." }, { status: 400 });
    }

    const updatedOrders = await Promise.all(
      ids.map(async (id) => {
        return prisma.order.update({
          where: { id },
          data: { status },
          include: {
            user: { select: orderUserSelect },
            orderItems: {
              include: {
                product: true,
                inventory: true,
              },
            },
          },
        });
      }),
    );

    // Log updated orders
    return safeJson(updatedOrders, { status: 200 });
  } catch (error) {
    console.error("Failed to update order statuses:", error);
    return safeJson({ error: "Failed to update order statuses." }, { status: 500 });
  }
};

export const dynamic = "force-dynamic";

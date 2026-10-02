import { errorResponse, HttpError, positiveIds } from "@/lib/http";
import { safeJson } from "@/lib/json";
import { orderUserSelect } from "@/lib/users";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { isAdmin } from "../../util/isAdmin";

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
        address: true, // Include address details
      },
    });

    return safeJson(orders, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return safeJson({ error: "Failed to fetch orders." }, { status: 500 });
  }
};

// PATCH: Update an order's status by ID
export const PATCH = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id, status } = await req.json();
    // Log incoming data

    // Validate the input
    if (!id || !status) {
      console.error("Validation error: Missing ID or status");
      return safeJson({ error: "Order ID and status are required." }, { status: 400 });
    }

    // Ensure the status is valid
    const validStatuses = ["PENDING", "SHIPPED", "TRANSIT", "DELIVERED"];
    if (!validStatuses.includes(status)) {
      console.error("Validation error: Invalid status");
      return safeJson({ error: "Invalid order status." }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
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
        address: true, // Include address details in the updated order
      },
    });

    // Log updated order
    return safeJson(updatedOrder, { status: 200 });
  } catch (error) {
    console.error("Failed to update order status:", error);
    return safeJson({ error: "Failed to update order status." }, { status: 500 });
  }
};

// DELETE: Remove an order by ID
export const DELETE = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { ids } = await req.json(); // Expecting an array of IDs

    // Validate the input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return safeJson({ error: "No valid IDs provided." }, { status: 400 });
    }

    positiveIds(ids);
    if (await prisma.order.count({ where: { id: { in: ids }, stockReserved: true } })) {
      throw new HttpError(409, "Cancel or expire the active checkout before deleting this order");
    }
    // Perform deletion for each ID
    const deletedOrders = await Promise.all(
      ids.map((id) => {
        return prisma.order.delete({
          where: { id },
          include: {
            user: { select: orderUserSelect },
            orderItems: {
              include: {
                product: true,
                inventory: true,
              },
            },
            address: true,
          },
        });
      }),
    );

    return safeJson(deletedOrders, { status: 200 });
  } catch (error) {
    console.error("Failed to delete orders:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

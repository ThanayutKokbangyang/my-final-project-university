import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "../../auth/authOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // ตรวจสอบการล็อกอินของผู้ใช้
  if (!session?.user?.id) {
    return safeJson({ message: "Unauthorized" }, { status: 401 });
  }

  const loggedInUserId = (session.user as { id: string }).id;

  try {
    // ดึงคำสั่งซื้อทั้งหมดของผู้ใช้ เรียงลำดับโดยวันที่สร้าง
    const orders = await prisma.order.findMany({
      where: { userId: loggedInUserId },
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
        address: true, // Include the address relation
      },
      orderBy: {
        createdAt: "desc", // เรียงคำสั่งซื้อจากล่าสุดไปเก่าสุด
      },
    });

    if (orders.length === 0) {
      return safeJson([]);
    }

    // แปลงข้อมูลจำนวนเงินและราคาของรายการสินค้าในคำสั่งซื้อให้เป็นตัวเลข
    const formattedOrders = orders.map((order) => ({
      ...order,
      totalAmount: order.totalAmount.toNumber(),
      orderItems: order.orderItems.map((item) => ({
        ...item,
        price: item.price.toNumber(),
      })),
    }));

    return safeJson(formattedOrders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return safeJson({ message: "Error fetching orders" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

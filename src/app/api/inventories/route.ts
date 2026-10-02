import { safeJson } from "@/lib/json";
import { parseInventories } from "@/lib/inventories";
import { errorResponse, HttpError } from "@/lib/http";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../util/isAdmin"; // นำเข้า isAdmin จากไฟล์ที่แยกไว้

// GET: ดึงข้อมูล Inventory ตาม productId หรือดึงทั้งหมด (ทุกคนสามารถเข้าถึงได้)
export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    let inventories;

    if (productId) {
      inventories = await prisma.inventory.findMany({
        where: {
          productId: parseInt(productId),
        },
      });
    } else {
      inventories = await prisma.inventory.findMany();
    }

    return safeJson(inventories, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch inventories:", error);
    return safeJson({ error: "Failed to fetch inventories." }, { status: 500 });
  }
};

// POST: เพิ่ม Inventory ใหม่ (เฉพาะ Admin)
export const POST = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { productId, size, price, stock } = await req.json();

    if (!productId || !size || !price || stock == null) {
      return safeJson({ error: "Missing required fields." }, { status: 400 });
    }

    parseInventories([{ size, price, stock }]);
    const newInventory = await prisma.inventory.create({
      data: {
        productId,
        size,
        price,
        stock,
      },
    });

    return safeJson(newInventory, { status: 201 });
  } catch (error) {
    console.error("Failed to create inventory:", error);
    return errorResponse(error);
  }
};

// PUT: แก้ไข Inventory ตาม ID (เฉพาะ Admin)
export const PUT = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id, size, price, stock } = await req.json();

    if (!id || !size || !price || stock == null) {
      return safeJson({ error: "Missing required fields." }, { status: 400 });
    }

    parseInventories([{ size, price, stock }]);
    const updatedInventory = await prisma.inventory.update({
      where: { id },
      data: {
        size,
        price,
        stock,
      },
    });

    return safeJson(updatedInventory, { status: 200 });
  } catch (error) {
    console.error("Failed to update inventory:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ Inventory ตาม ID (เฉพาะ Admin)
export const DELETE = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return safeJson({ error: "Missing required field: id." }, { status: 400 });
    }

    if (await prisma.orderItem.count({ where: { inventoryId: id } }))
      throw new HttpError(409, "Cannot delete an inventory referenced by an order");
    const deletedInventory = await prisma.inventory.delete({
      where: { id },
    });

    return safeJson(deletedInventory, { status: 200 });
  } catch (error) {
    console.error("Failed to delete inventory:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

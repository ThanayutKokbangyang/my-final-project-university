import { errorResponse, positiveInt } from "@/lib/http";
import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../util/isAdmin";

// GET: ดึงข้อมูล ProductType ทั้งหมด หรือค้นหาตามชื่อ (ทุกคนสามารถเข้าถึงได้)
export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get("name");

    let productTypes;

    if (nameQuery) {
      productTypes = await prisma.productType.findMany({
        where: {
          name: {
            contains: nameQuery,
          },
        },
        include: {
          products: true, // หากต้องการรวมข้อมูล Product ที่เกี่ยวข้อง
        },
      });
    } else {
      productTypes = await prisma.productType.findMany({
        include: {
          products: true,
        },
      });
    }

    return safeJson(productTypes, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch product types:", error);
    return errorResponse(error);
  }
};

// POST: เพิ่ม ProductType ใหม่ (เฉพาะผู้ใช้ที่เป็น Admin)
export const POST = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { name } = await req.json();

    if (typeof name !== "string" || !name.trim() || name.length > 100) {
      return safeJson({ error: "Missing required field: name." }, { status: 400 });
    }

    const newProductType = await prisma.productType.create({
      data: {
        name,
      },
    });

    return safeJson(newProductType, { status: 201 });
  } catch (error) {
    console.error("Failed to create product type:", error);
    return errorResponse(error);
  }
};

// PUT: แก้ไขข้อมูล ProductType ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
export const PUT = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id, name } = await req.json();

    if (!positiveInt(id) || typeof name !== "string" || !name.trim() || name.length > 100) {
      return safeJson({ error: "Missing required fields: id or name." }, { status: 400 });
    }

    const updatedProductType = await prisma.productType.update({
      where: { id },
      data: {
        name,
      },
    });
    return safeJson(updatedProductType, { status: 200 });
  } catch (error) {
    console.error("Failed to update product type:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ ProductType ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
export const DELETE = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id } = await req.json();

    if (!positiveInt(id)) {
      return safeJson({ error: "Missing required field: id." }, { status: 400 });
    }

    const deletedProductType = await prisma.productType.delete({
      where: { id },
    });
    return safeJson(deletedProductType, { status: 200 });
  } catch (error) {
    console.error("Failed to delete product type:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

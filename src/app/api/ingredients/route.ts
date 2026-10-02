import { errorResponse, positiveInt } from "@/lib/http";
import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../util/isAdmin"; // นำเข้า isAdmin จากไฟล์ที่แยกไว้

// GET: ดึงข้อมูล Ingredient ทั้งหมดหรือค้นหาตามชื่อ
export const GET = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get("name");

    let ingredients;

    if (nameQuery) {
      ingredients = await prisma.ingredient.findMany({
        where: {
          name: {
            contains: nameQuery,
          },
        },
        include: {
          products: true,
        },
      });
    } else {
      ingredients = await prisma.ingredient.findMany({
        include: {
          products: true,
        },
      });
    }

    return safeJson(ingredients, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch ingredients:", error);
    return errorResponse(error);
  }
};

// POST: เพิ่ม Ingredient ใหม่ (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const newIngredient = await prisma.ingredient.create({
      data: { name },
    });

    return safeJson(newIngredient, { status: 201 });
  } catch (error) {
    console.error("Failed to create ingredient:", error);
    return errorResponse(error);
  }
};

// PUT: แก้ไข Ingredient ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const updatedIngredient = await prisma.ingredient.update({
      where: { id },
      data: { name },
    });

    return safeJson(updatedIngredient, { status: 200 });
  } catch (error) {
    console.error("Failed to update ingredient:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ Ingredient ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const deletedIngredient = await prisma.ingredient.delete({
      where: { id },
    });

    return safeJson(deletedIngredient, { status: 200 });
  } catch (error) {
    console.error("Failed to delete ingredient:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

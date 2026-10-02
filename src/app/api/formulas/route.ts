import { errorResponse, positiveInt } from "@/lib/http";
import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../util/isAdmin"; // นำเข้า isAdmin จากไฟล์ที่แยกไว้ (ยังคงไว้สำหรับ POST, PUT, DELETE)

// GET: ดึงข้อมูล Formula ทั้งหมด หรือค้นหาตามชื่อ (ทุกคนสามารถเข้าถึงได้)
export const GET = async (req: NextRequest) => {
  try {
    // ดึง query parameter จาก URL
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get("name"); // ดึงค่า name จาก query

    let formulas;

    // ตรวจสอบว่า query parameter 'name' มีการส่งค่ามาหรือไม่
    if (nameQuery) {
      // ใช้ฟังก์ชัน prisma.findMany เพื่อทำการค้นหาแบบ case-insensitive
      formulas = await prisma.formula.findMany({
        where: {
          name: {
            contains: nameQuery,
          },
        },
        include: {
          products: true, // หากต้องการรวมข้อมูล product ที่เกี่ยวข้อง
        },
      });
    } else {
      // ดึงข้อมูลทั้งหมด
      formulas = await prisma.formula.findMany({
        include: {
          products: true, // หากต้องการรวมข้อมูล product ที่เกี่ยวข้อง
        },
      });
    }

    return safeJson(formulas, { status: 200 });
  } catch (error) {
    console.error(error);
    return errorResponse(error);
  }
};

// POST: เพิ่ม Formula ใหม่ (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const newFormula = await prisma.formula.create({
      data: {
        name,
      },
    });

    return safeJson(newFormula, { status: 201 });
  } catch (error) {
    console.error("Failed to create formula:", error);
    return errorResponse(error);
  }
};

// PUT: แก้ไขข้อมูล Formula ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const updatedFormula = await prisma.formula.update({
      where: { id },
      data: {
        name,
      },
    });
    return safeJson(updatedFormula, { status: 200 });
  } catch (error) {
    console.error("Failed to update formula:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ Formula ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const deletedFormula = await prisma.formula.delete({
      where: { id },
    });
    return safeJson(deletedFormula, { status: 200 });
  } catch (error) {
    console.error("Failed to delete formula:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

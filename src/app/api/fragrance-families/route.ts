import { errorResponse, positiveInt } from "@/lib/http";
import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import { isAdmin } from "../../util/isAdmin"; // นำเข้า isAdmin จากไฟล์ที่แยกไว้ (ยังคงไว้สำหรับ POST, PUT, DELETE)

// GET: ดึงข้อมูล FragranceFamily ทั้งหมด หรือค้นหาตามชื่อ (ทุกคนสามารถเข้าถึงได้)
export const GET = async (req: NextRequest) => {
  try {
    // ดึง query parameter จาก URL
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get("name"); // ดึงค่า name จาก query

    let fragranceFamilies;

    // ตรวจสอบว่า query parameter 'name' มีการส่งค่ามาหรือไม่
    if (nameQuery) {
      // ใช้ฟังก์ชัน prisma.$queryRaw เพื่อทำการค้นหาแบบ case-insensitive
      fragranceFamilies = await prisma.fragranceFamily.findMany({
        where: {
          name: {
            contains: nameQuery,
            // ใช้ case insensitive ด้วยวิธีการแปลงค่าเป็น lowercase ทั้งสองด้านของการเปรียบเทียบ
          },
        },
        include: {
          products: true, // หากต้องการรวมข้อมูล product ที่เกี่ยวข้อง
        },
      });
    } else {
      // ดึงข้อมูลทั้งหมด
      fragranceFamilies = await prisma.fragranceFamily.findMany({
        include: {
          products: true, // หากต้องการรวมข้อมูล product ที่เกี่ยวข้อง
        },
      });
    }

    return safeJson(fragranceFamilies, { status: 200 });
  } catch (error) {
    console.error(error);
    return errorResponse(error);
  }
};

// POST: เพิ่ม FragranceFamily ใหม่ (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const newFragranceFamily = await prisma.fragranceFamily.create({
      data: {
        name,
      },
    });

    return safeJson(newFragranceFamily, { status: 201 });
  } catch (error) {
    console.error("Failed to create fragrance family:", error);
    return errorResponse(error);
  }
};

// PUT: แก้ไขข้อมูล FragranceFamily ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const updatedFragranceFamily = await prisma.fragranceFamily.update({
      where: { id },
      data: {
        name,
      },
    });
    return safeJson(updatedFragranceFamily, { status: 200 });
  } catch (error) {
    console.error("Failed to update fragrance family:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ FragranceFamily ตาม ID (เฉพาะผู้ใช้ที่เป็น Admin)
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

    const deletedFragranceFamily = await prisma.fragranceFamily.delete({
      where: { id },
    });
    return safeJson(deletedFragranceFamily, { status: 200 });
  } catch (error) {
    console.error("Failed to delete fragrance family:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

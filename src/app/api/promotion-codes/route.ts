import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";

import { isAdmin } from "../../util/isAdmin"; // นำเข้า isAdmin

export const GET = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const promotionCodes = await prisma.promotionCode.findMany();

    const currentTime = new Date();

    const updatedPromotionCodes = promotionCodes.map((promotion) => {
      if (currentTime < promotion.startDate) {
        promotion.status = "NOT_YET_VALID";
      } else if (currentTime > promotion.endDate) {
        promotion.status = "EXPIRED";
      } else {
        promotion.status = "ACTIVE";
      }
      return promotion;
    });

    // อัปเดตสถานะในฐานข้อมูล
    await Promise.all(
      updatedPromotionCodes.map((promotion) =>
        prisma.promotionCode.update({
          where: { id: promotion.id },
          data: { status: promotion.status },
        }),
      ),
    );

    return safeJson(updatedPromotionCodes, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch promotion codes:", error);
    return safeJson({ error: "Failed to fetch promotion codes." }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { code, discountPercentage, startDate, endDate, description } = await req.json();

    if (!code || !discountPercentage || !startDate || !endDate || !description) {
      return safeJson({ error: "Missing required fields." }, { status: 400 });
    }

    const newPromotionCode = await prisma.promotionCode.create({
      data: {
        code,
        discountPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        status: new Date() < new Date(startDate) ? "NOT_YET_VALID" : "ACTIVE", // กำหนดสถานะเริ่มต้น
      },
    });

    return safeJson(newPromotionCode, { status: 201 });
  } catch (error) {
    console.error("Failed to create promotion code:", error);
    return safeJson({ error: "Failed to create promotion code." }, { status: 500 });
  }
};

export const PUT = async (req: NextRequest) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id, code, discountPercentage, startDate, endDate, description } = await req.json();

    if (!id || !code || !discountPercentage || !startDate || !endDate || !description) {
      return safeJson({ error: "Missing required fields." }, { status: 400 });
    }

    const updatedPromotionCode = await prisma.promotionCode.update({
      where: { id },
      data: {
        code,
        discountPercentage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        description,
        status:
          new Date() < new Date(startDate)
            ? "NOT_YET_VALID"
            : new Date() > new Date(endDate)
              ? "EXPIRED"
              : "ACTIVE", // ตรวจสอบสถานะใหม่
      },
    });

    return safeJson(updatedPromotionCode, { status: 200 });
  } catch (error) {
    console.error("Failed to update promotion code:", error);
    return safeJson({ error: "Failed to update promotion code." }, { status: 500 });
  }
};

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

    const deletedPromotionCode = await prisma.promotionCode.delete({
      where: { id },
    });

    return safeJson(deletedPromotionCode, { status: 200 });
  } catch (error) {
    console.error("Failed to delete promotion code:", error);
    return safeJson({ error: "Failed to delete promotion code." }, { status: 500 });
  }
};
export const dynamic = "force-dynamic";

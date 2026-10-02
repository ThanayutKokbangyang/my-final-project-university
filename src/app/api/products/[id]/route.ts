import { safeJson } from "@/lib/json";
import { syncInventories } from "@/lib/inventories";
import { errorResponse, HttpError } from "@/lib/http";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Gender } from "@prisma/client";
import { isAdmin } from "../../../util/isAdmin";

// GET: Fetch product details by ID, including inventory sorted by price
export const GET = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params;

  try {
    // Check if the product ID is provided
    if (!id) {
      return safeJson({ error: "Missing product ID." }, { status: 400 });
    }

    // Fetch product with inventories (sorted by price ascending)
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }, // Convert ID to number
      include: {
        fragranceFamily: true,
        productType: true,
        formula: true,
        ingredient: true,
        Inventory: {
          orderBy: { price: "asc" }, // Sort inventory by price ascending
        },
      },
    });

    // Check if the product exists
    if (!product) {
      return safeJson({ error: "Product not found." }, { status: 404 });
    }

    // Transform the image field from string to array of URLs
    const productWithImages = {
      ...product,
      images: product.image ? product.image.split(",") : [], // Split the image string into an array
    };

    return safeJson(productWithImages, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch product by ID:", error);
    return safeJson({ error: "Failed to fetch product." }, { status: 500 });
  }
};

// PUT: แก้ไข Product ตาม ID (เฉพาะ Admin)
export const PUT = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id } = params;
    const {
      title,
      description,
      howToUse,
      images,
      isNew,
      gender,
      fragranceFamilyId,
      productTypeId,
      formulaId,
      ingredientId,
      inventories, // Accept inventories from the request body
    } = await req.json();

    // Debug: Log received inventory data

    // ตรวจสอบว่า gender ที่ส่งมาเป็นค่าที่อยู่ใน enum Gender หรือไม่
    if (!Object.values(Gender).includes(gender)) {
      return safeJson({ error: `Invalid value for gender: ${gender}` }, { status: 400 });
    }

    // ตรวจสอบว่า images เป็น array ของ string หรือไม่
    if (!Array.isArray(images) || images.some((image) => typeof image !== "string")) {
      return safeJson(
        { error: "Invalid value for images. Must be an array of strings." },
        { status: 400 },
      );
    }

    // รวม URL ของภาพทั้งหมดใน array เป็น string เดียวคั่นด้วย ,
    const imageString = images.join(",");

    // ตรวจสอบว่ามีฟิลด์ที่จำเป็นครบถ้วนหรือไม่
    if (
      !id ||
      !title ||
      !description ||
      !howToUse ||
      images.length === 0 ||
      !gender ||
      !fragranceFamilyId ||
      !productTypeId ||
      !formulaId ||
      !ingredientId
    ) {
      return safeJson({ error: "Missing required fields." }, { status: 400 });
    }

    if (!/^\d+$/.test(id) || Number(id) <= 0 || !Number.isSafeInteger(Number(id)))
      throw new HttpError(400, "Invalid product ID");
    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id: Number(id) },
        data: {
          title,
          description,
          howToUse,
          image: imageString,
          isNew,
          gender,
          fragranceFamilyId,
          productTypeId,
          formulaId,
          ingredientId,
        },
      });
      if (inventories !== undefined) await syncInventories(tx, product.id, inventories);
      return product;
    });

    return safeJson(updatedProduct, { status: 200 });
  } catch (error) {
    console.error("Failed to update product:", error);
    return errorResponse(error);
  }
};

// DELETE: ลบ Product ตาม ID (เฉพาะ Admin)
export const DELETE = async (req: NextRequest, { params }: { params: { id: string } }) => {
  const isAdminUser = await isAdmin(req);
  if (!isAdminUser) {
    return safeJson({ error: "Access denied: Admins only" }, { status: 403 });
  }

  try {
    const { id } = params;

    if (!id) {
      return safeJson({ error: "Missing required field: id." }, { status: 400 });
    }

    if (await prisma.orderItem.count({ where: { productId: Number(id) } })) {
      throw new HttpError(409, "Cannot delete a product referenced by an order");
    }
    const deletedProduct = await prisma.product.delete({
      where: { id: parseInt(id) },
    });

    return safeJson(deletedProduct, { status: 200 });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return errorResponse(error);
  }
};

export const dynamic = "force-dynamic";

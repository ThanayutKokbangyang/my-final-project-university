import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, HttpError, positiveInt, readBody, requireUser } from "@/lib/http";
import { safeJson } from "@/lib/json";
import { serializable } from "@/lib/payments";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const requested = req.nextUrl.searchParams.get("userId");
    const all = user.role === "ADMIN" && req.nextUrl.searchParams.get("all") === "1";
    const userId = user.role === "ADMIN" && requested ? requested : user.id;
    return safeJson(
      await prisma.address.findMany({
        where: all ? {} : { userId },
        orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function addressData(body: Record<string, unknown>) {
  const fields = [
    "recipient",
    "phoneNumber",
    "address",
    "district",
    "province",
    "zipCode",
    "country",
  ] as const;
  for (const key of fields)
    if (typeof body[key] !== "string" || !body[key].trim() || body[key].length > 2000)
      throw new HttpError(400, `Invalid ${key}`);
  if (body.isDefault !== undefined && typeof body.isDefault !== "boolean")
    throw new HttpError(400, "Invalid default address flag");
  return {
    recipient: (body.recipient as string).trim(),
    phoneNumber: (body.phoneNumber as string).trim(),
    address: (body.address as string).trim(),
    district: (body.district as string).trim(),
    province: (body.province as string).trim(),
    zipCode: (body.zipCode as string).trim(),
    country: (body.country as string).trim(),
    ...(body.isDefault === undefined ? {} : { isDefault: body.isDefault }),
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const data = addressData(await readBody(req));
    const result = await serializable(async (tx) => {
      if (data.isDefault)
        await tx.address.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      return tx.address.create({ data: { userId: user.id, ...data } });
    });
    return safeJson(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    if (!positiveInt(body.addressId)) throw new HttpError(400, "Invalid address ID");
    const addressId = body.addressId;
    const data = addressData(body);
    const result = await serializable(async (tx) => {
      const existing = await tx.address.findUnique({ where: { id: addressId } });
      if (!existing) throw new HttpError(404, "Address not found");
      if (existing.userId !== user.id && user.role !== "ADMIN")
        throw new HttpError(403, "Forbidden");
      if (data.isDefault)
        await tx.address.updateMany({
          where: { userId: existing.userId, isDefault: true },
          data: { isDefault: false },
        });
      return tx.address.update({ where: { id: addressId }, data });
    });
    return safeJson(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { addressId } = await readBody(req);
    if (!positiveInt(addressId)) throw new HttpError(400, "Invalid address ID");
    const result = await prisma.address.deleteMany({
      where: { id: addressId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    });
    if (!result.count) throw new HttpError(404, "Address not found");
    return safeJson({ message: "Address deleted successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}

export const dynamic = "force-dynamic";

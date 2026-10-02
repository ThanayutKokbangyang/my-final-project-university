import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { safeUserSelect } from "@/lib/users";
import { errorResponse, HttpError, readBody, requireUser } from "@/lib/http";
import { safeJson } from "@/lib/json";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admins only");
    const body = await readBody(req);
    if (typeof body.userId !== "string" || !body.userId)
      throw new HttpError(400, "User ID is required");
    const data: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100)
        throw new HttpError(400, "Invalid name");
      data.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
        throw new HttpError(400, "Invalid email");
      data.email = body.email;
    }
    if (body.role !== undefined) {
      if (body.role !== "USER" && body.role !== "ADMIN") throw new HttpError(400, "Invalid role");
      if (body.userId === user.id && body.role !== "ADMIN")
        throw new HttpError(409, "Cannot remove your own admin role here");
      data.role = body.role;
    }
    if (body.password) {
      if (
        typeof body.password !== "string" ||
        body.password.length < 8 ||
        Buffer.byteLength(body.password, "utf8") > 72
      )
        throw new HttpError(400, "Invalid password");
      data.password = await bcrypt.hash(body.password, 10);
    }
    const entry = await prisma.user.update({
      where: { id: body.userId },
      data,
      select: safeUserSelect,
    });
    return safeJson({ message: "User updated successfully", user: entry });
  } catch (error) {
    return errorResponse(error);
  }
}
export const dynamic = "force-dynamic";

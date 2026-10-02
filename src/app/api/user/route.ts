import { NextRequest } from "next/server";
import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "@/lib/prisma";
import { safeUserSelect } from "@/lib/users";
import { errorResponse, HttpError, readBody, requireUser } from "@/lib/http";
import { safeJson } from "@/lib/json";

function passwordValid(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}
function profileData(body: Record<string, unknown>) {
  const data: { name?: string; email?: string; role?: Role } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100)
      throw new HttpError(400, "Invalid name");
    data.name = body.name.trim();
  }
  if (body.email !== undefined) {
    if (
      typeof body.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
      body.email.length > 254
    )
      throw new HttpError(400, "Invalid email");
    data.email = body.email;
  }
  if (body.role !== undefined) {
    if (body.role !== "USER" && body.role !== "ADMIN")
      throw new HttpError(400, "Invalid user role");
    data.role = body.role;
  }
  return data;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const requestedId = req.nextUrl.searchParams.get("userId");
    const isList =
      user.role === "ADMIN" && !requestedId && req.nextUrl.searchParams.get("self") !== "1";
    const withProvider = (entry: Prisma.UserGetPayload<{ select: typeof safeUserSelect }>) => ({
      ...entry,
      provider: entry.accounts[0]?.provider ?? "credentials",
    });
    if (isList)
      return safeJson((await prisma.user.findMany({ select: safeUserSelect })).map(withProvider));
    const targetId = user.role === "ADMIN" && requestedId ? requestedId : user.id;
    const entry = await prisma.user.findUnique({ where: { id: targetId }, select: safeUserSelect });
    if (!entry) throw new HttpError(404, "User not found");
    return safeJson(withProvider(entry));
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admins only");
    const body = await readBody(req);
    const data = profileData(body);
    if (!data.name || !data.email || !data.role || !passwordValid(body.password))
      throw new HttpError(
        400,
        "Name, email, role, and a password of 8 characters or more are required",
      );
    const entry = await prisma.user.create({
      data: {
        ...data,
        email: data.email,
        password: await bcrypt.hash(body.password, 10),
        emailVerified: new Date(),
      },
      select: safeUserSelect,
    });
    return safeJson({ message: "User added successfully", user: entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readBody(req);
    if (body.userIdParam !== user.id) throw new HttpError(403, "Forbidden");
    if (body.role !== undefined && user.role !== "ADMIN")
      throw new HttpError(403, "Only admins can change user roles");
    const data: Prisma.UserUpdateInput = profileData(body);
    if (body.newPassword) {
      if (typeof body.currentPassword !== "string" || !body.currentPassword)
        throw new HttpError(400, "Current password is required");
      if (!passwordValid(body.newPassword))
        throw new HttpError(
          400,
          "Password must contain at least 8 characters and at most 72 bytes",
        );
      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      if (!existing?.password || !(await bcrypt.compare(body.currentPassword, existing.password)))
        throw new HttpError(400, "Current password is incorrect");
      data.password = await bcrypt.hash(body.newPassword, 10);
    }
    return safeJson(
      await prisma.user.update({ where: { id: user.id }, data, select: safeUserSelect }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") throw new HttpError(403, "Admins only");
    const { userId } = await readBody(req);
    if (typeof userId !== "string" || !userId) throw new HttpError(400, "User ID is required");
    if (userId === user.id) throw new HttpError(409, "Cannot delete the account currently in use");
    if (await prisma.order.count({ where: { userId, stockReserved: true } }))
      throw new HttpError(409, "Cancel active checkouts before deleting this user");
    await prisma.user.delete({ where: { id: userId } });
    return safeJson({ message: "User deleted successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
export const dynamic = "force-dynamic";

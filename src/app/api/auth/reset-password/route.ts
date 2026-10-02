import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import bcrypt from "bcrypt";

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const { token, email, newPassword } = body;

    if (
      typeof token !== "string" ||
      typeof email !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return safeJson({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Validate the token and expiration
    if (
      !user ||
      !user.resetPasswordToken ||
      user.resetPasswordToken !== token ||
      !user.resetPasswordExpires ||
      new Date() > new Date(user.resetPasswordExpires)
    ) {
      return safeJson({ error: "Invalid or expired token" }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password and clear the reset token and expiration date
    const updated = await prisma.user.updateMany({
      where: { email, resetPasswordToken: token, resetPasswordExpires: { gt: new Date() } },
      data: {
        password: hashedPassword,
        resetPasswordToken: null, // Clear the reset token
        resetPasswordExpires: null, // Clear the expiration
      },
    });

    if (updated.count !== 1)
      return safeJson({ error: "Invalid or expired token" }, { status: 400 });

    return safeJson({ message: "Password reset successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return safeJson({ error: "Internal server error" }, { status: 500 });
  }
};

export const GET = () => {
  return safeJson({ error: "Method not allowed" }, { status: 405 });
};

export const dynamic = "force-dynamic";

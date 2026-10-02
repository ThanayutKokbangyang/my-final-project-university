import { safeJson } from "@/lib/json";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

import crypto from "crypto";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return safeJson({ error: "User not found" }, { status: 404 });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetPasswordExpires = new Date(Date.now() + 600000); // 10 minute expiration

    // Update the user with the unhashed reset token and expiration date
    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: resetToken, // Store the unhashed token
        resetPasswordExpires,
      },
    });

    // Set up nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    // Create reset password URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}&email=${email}`;

    // Email options
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Password Reset",
      text: `คุณได้ทำการร้องขอการรีเซ็ตรหัสผ่าน กรุณาคลิกลิงก์ด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ:\n\n${resetUrl}`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    return safeJson({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error during forgot password process:", error);
    return safeJson({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { safeJson } from "./json";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/authOptions";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new HttpError(401, "Unauthorized");
  return session.user;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch {
    throw new HttpError(400, "Invalid JSON request body");
  }
}

export function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function positiveIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 || !value.every(positiveInt)) {
    throw new HttpError(400, "A non-empty list of positive integer IDs is required");
  }
  return [...new Set(value)];
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError)
    return safeJson({ message: error.message, error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return safeJson(
        { error: "This entry already exists", message: "This entry already exists" },
        { status: 409 },
      );
    if (error.code === "P2003")
      return safeJson(
        {
          error: "This entry is still referenced by another record",
          message: "This entry is still referenced by another record",
        },
        { status: 409 },
      );
    if (error.code === "P2025")
      return safeJson({ error: "Record not found", message: "Record not found" }, { status: 404 });
  }
  // Log the failure without including request bodies, passwords, or tokens.
  console.error(error instanceof Error ? error.message : "Unexpected server error");
  return safeJson({ message: "Internal server error" }, { status: 500 });
}

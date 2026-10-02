import { NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";

const privateFields = new Set([
  "password",
  "resetPasswordToken",
  "resetPasswordExpires",
  "access_token",
  "refresh_token",
  "id_token",
]);
export function publicData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicData);
  if (value && typeof value === "object") {
    // Match JSON serialization of Dates and Prisma Decimals before walking objects.
    if ("toJSON" in value && typeof value.toJSON === "function") return publicData(value.toJSON());
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateFields.has(key))
        .map(([key, item]) => [
          key,
          ["description", "howToUse"].includes(key) && typeof item === "string"
            ? sanitizeHtml(item, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
                allowedAttributes: {
                  ...sanitizeHtml.defaults.allowedAttributes,
                  "*": ["class"],
                  img: ["src", "alt", "width", "height"],
                },
                allowedSchemes: ["http", "https", "mailto"],
              })
            : publicData(item),
        ]),
    );
  }
  return value;
}
export function safeJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(publicData(body), init);
}

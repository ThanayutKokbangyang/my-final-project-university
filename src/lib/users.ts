import { Prisma } from "@prisma/client";

// Never send password hashes, reset tokens, or OAuth access/refresh tokens to the browser.
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  updateAt: true,
  accounts: { select: { provider: true } },
  Address: true,
} satisfies Prisma.UserSelect;

export const orderUserSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

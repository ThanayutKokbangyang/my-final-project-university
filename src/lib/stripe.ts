import Stripe from "stripe";
import { HttpError } from "./http";

let client: Stripe | undefined;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Payment service is not configured");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-09-30.acacia" });
  return client;
}

export function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (!value) throw new HttpError(503, "Application URL is not configured");
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new HttpError(503, "Invalid application URL");
  return url.origin;
}

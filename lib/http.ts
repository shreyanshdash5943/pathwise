import "server-only";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "./supabase";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof UnauthorizedError) return jsonError("Sign in to continue.", 401);
  console.error("[api]", err);
  return jsonError("Something went wrong on our side. Try again in a moment.", 500);
}

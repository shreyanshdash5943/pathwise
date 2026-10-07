import "server-only";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "./supabase";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof UnauthorizedError) return jsonError("Sign in to continue.", 401);
  console.error("[api]", err);
  // 23514: a database check rejected the data (e.g. a field over its size limit).
  if ((err as { code?: string } | null)?.code === "23514") return jsonError("Some of that is too long or in the wrong format.", 400);
  return jsonError("Something went wrong on our side. Try again in a moment.", 500);
}

import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client that authenticates as the signed-in Clerk user.
 * Uses Supabase's native Clerk third-party auth integration, so Row Level Security
 * policies can read the Clerk user id from auth.jwt()->>'sub'.
 */
export async function getSupabase(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const { userId, getToken } = await auth();
  if (!userId) throw new UnauthorizedError();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase environment variables are missing.");

  const supabase = createClient(url, anon, {
    accessToken: async () => (await getToken()) ?? null,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabase, userId };
}

/**
 * Supabase client with no user. It can only call functions granted to anon, such as
 * get_public_profile() and the secret-checked reminder job functions.
 */
export function getAnonSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase environment variables are missing.");
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

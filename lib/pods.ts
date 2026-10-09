import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accountability pods: small invite-only groups who see each other's streaks and cheer
 * each other on. Every read and write goes through a membership-checked database
 * function (see supabase/migrations/008_pods.sql), so the tables are never touched
 * directly and a pod view exposes only name, role, streak and weekly activity.
 */

export type PodSummary = { id: string; name: string; members: number; is_owner: boolean };

export type PodMember = {
  user_id: string;
  name: string | null;
  avatar: string | null;
  is_me: boolean;
  is_owner: boolean;
  role: string | null;
  has_plan: boolean;
  streak: number;
  active_today: boolean;
  active_week: number;
  cheers: number;
  cheered_by_me: boolean;
  username: string | null;
};

export type PodPost = { id: string; user_id: string; name: string | null; avatar: string | null; body: string; created_at: string };

export type Pod = {
  id: string;
  name: string;
  invite_code: string;
  is_owner: boolean;
  members: PodMember[];
  posts: PodPost[];
};

export async function getMyPods(supabase: SupabaseClient): Promise<PodSummary[]> {
  const { data, error } = await supabase.rpc("get_my_pods");
  if (error) return []; // before migration 008
  return (data ?? []) as PodSummary[];
}

export async function getPod(supabase: SupabaseClient, podId: string): Promise<Pod | null> {
  const { data, error } = await supabase.rpc("get_pod", { p_pod_id: podId });
  if (error || !data) return null;
  return data as Pod;
}

import "server-only";
import { currentUser } from "@clerk/nextjs/server";

/**
 * The name and avatar stored on a pod membership, taken from Clerk at join time so pod
 * views never call Clerk (same pattern as public profiles). Returns safe, bounded values.
 */
export async function podIdentity(): Promise<{ name: string; avatar: string | null }> {
  const user = await currentUser();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "A member";
  const avatar = user?.hasImage && user.imageUrl?.startsWith("https://") && user.imageUrl.length <= 500 ? user.imageUrl : null;
  return { name: name.slice(0, 80), avatar };
}

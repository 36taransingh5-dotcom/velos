import { auth } from '@clerk/nextjs/server';

/**
 * Tenant id for dashboard pages: the active Clerk org, or a personal
 * workspace derived from the user id so solo users work out of the box.
 * Must stay in lockstep with requireOrg() in dashboard actions.
 */
export async function tenantId(): Promise<string> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error('Not signed in.');
  return orgId ?? `user_${userId}`;
}

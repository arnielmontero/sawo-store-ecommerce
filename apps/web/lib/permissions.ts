import type { SessionUser } from "./api";

// Single source of truth for "can this account do X" on the client, mirroring
// the server's requirePermission() middleware — including its super-admin
// short-circuit, so the two can't disagree about who sees a control.
//
// Before this existed, pages hand-rolled `user?.role === "ADMIN"` checks that
// drifted out of sync with what the API actually allowed (several pages hid
// controls from Managers that the backend would have accepted).
export function hasPermission(
  user: SessionUser | null,
  module: string,
  action: string
): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.includes(`${module}:${action}`);
}

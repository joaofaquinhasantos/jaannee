/**
 * Keep anonymous and following feeds restricted to users who chose a public
 * profile. A missing profile must never be treated as permission to publish.
 */
export type ActivityVisibility = {
  type: string;
  profile?: {
    username?: string | null;
    tried_public?: boolean | null;
  } | null;
};

export function isPublicActivity(item: ActivityVisibility): boolean {
  if (typeof item.profile?.username !== "string" || !item.profile.username.trim()) {
    return false;
  }
  return item.type !== "tried" || item.profile.tried_public === true;
}

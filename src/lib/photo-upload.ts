// Shared photo upload validation + path generation for the public submit
// flow and the admin uploader. Keeping these together guarantees both
// clients enforce the same limits so the private `dish-photos` bucket
// (served through /photos/*) never receives an oversized file, a wrong
// MIME type, a zero-byte object, or a caller-controlled filename.

export const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedPhotoMime = typeof ALLOWED_PHOTO_MIME[number];

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

// Use in <input accept=...> so browsers filter the picker to the same
// MIME set the server accepts.
export const PHOTO_ACCEPT_ATTR = ALLOWED_PHOTO_MIME.join(",");

export function storagePathFromPhotoUrl(url: string | null | undefined): string | null {
  if (!url?.startsWith("/photos/")) return null;
  const path = url.slice("/photos/".length);
  if (!path || path.includes("..")) return null;
  return path;
}

export function validatePhotoFile(file: File) {
  if (!file) throw new Error("Choose a photo to upload.");
  if (file.size === 0) throw new Error("This file is empty. Pick a different photo.");
  if (!ALLOWED_PHOTO_MIME.includes(file.type as AllowedPhotoMime))
    throw new Error("Photo must be JPEG, PNG, or WebP.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo must be 8 MB or smaller.");
}

export function photoExtFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

// Storage path shape: `<user_id>/<uuid>.<ext>`. The filename is never
// derived from the user-supplied name, which keeps the bucket free of
// tracking data, weird characters, and predictable collisions.
export function buildPhotoPath(userId: string, file: File) {
  const ext = photoExtFor(file.type);
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

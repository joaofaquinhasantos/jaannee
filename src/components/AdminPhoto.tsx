import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns a same-origin blob URL only when the current session is entitled to view it. */
function useAdminPhotoUrl(photoUrl: string | null | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | undefined;
    if (!photoUrl) {
      setResolved(undefined);
      return;
    }
    if (!photoUrl.startsWith("/photos/")) {
      setResolved(photoUrl);
      return;
    }
    setResolved(undefined);
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch(photoUrl, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "same-origin",
        });
        if (!response.ok || cancelled) return;
        const media = await response.blob();
        if (!media.type.startsWith("image/")) return;
        blobUrl = URL.createObjectURL(media);
        if (cancelled) URL.revokeObjectURL(blobUrl);
        else setResolved(blobUrl);
      } catch {
        // The server intentionally returns no media for unauthorized uploads.
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoUrl]);

  return resolved;
}

export function AdminPhotoLink({ src, name }: { src: string | null | undefined; name: string }) {
  const resolved = useAdminPhotoUrl(src);
  return (
    <a
      href={resolved}
      target={resolved ? "_blank" : undefined}
      rel="noreferrer"
      className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
      aria-label={resolved ? `Open photo for ${name}` : undefined}
    >
      {resolved ? (
        <img src={resolved} className="h-full w-full object-cover" alt="" />
      ) : (
        <span className="flex h-full items-center justify-center text-center text-[10px] text-muted-foreground">
          {src ? "Loading photo" : "No photo"}
        </span>
      )}
    </a>
  );
}

export function AdminPhotoImage({ src, alt, className }: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const resolved = useAdminPhotoUrl(src);
  return resolved ? <img src={resolved} alt={alt ?? ""} className={className} /> : null;
}

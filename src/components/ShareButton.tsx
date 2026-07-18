import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  url: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
};

export function ShareButton({ url, title, text, className, label = "Share" }: Props) {
  const onClick = async () => {
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, text, url });
        return;
      }
    } catch {
      // fall through to fallback
    }
    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    try {
      window.open(fb, "_blank", "noopener,noreferrer");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Could not share");
      }
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className={className}>
      {label}
    </Button>
  );
}
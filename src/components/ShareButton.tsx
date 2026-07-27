import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type Props = {
  url: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
};

export function ShareButton({ url, title, text, className, label }: Props) {
  const { t, lang } = useI18n();
  const onClick = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    const popup = window.open(fb, "_blank", "noopener,noreferrer");
    if (popup) return;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(lang === "th" ? "คัดลอกลิงก์แล้ว" : "Link copied");
    } catch {
      toast.error(lang === "th" ? "ไม่สามารถแชร์ได้" : "Could not share");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className={className}>
      {label ?? t("share")}
    </Button>
  );
}

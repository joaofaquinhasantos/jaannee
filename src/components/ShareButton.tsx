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
  const buttonLabel = label ?? t("share");

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast.success(t("link_copied"));
  };

  const onClick = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await copyLink();
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return;
      try {
        await copyLink();
      } catch {
        toast.error(lang === "th" ? "ไม่สามารถแชร์ได้" : "Could not share");
      }
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className={className}>
      {buttonLabel}
    </Button>
  );
}

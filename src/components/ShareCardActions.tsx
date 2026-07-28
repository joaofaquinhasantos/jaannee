import { useState } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  SHARE_FORMATS,
  shareText,
  type ComparisonCardModel,
  type FoodPostCardModel,
  type RankingCardModel,
  type ShareFormat,
} from "@/lib/share-card";

/**
 * Share / copy / download actions for a generated card.
 *
 * Cancelling the native share sheet must be silent: it throws AbortError,
 * which is a normal user action, not an error.
 */
export function ShareCardActions({
  model,
  filenameBase,
  shareImageFormat,
}: {
  model: ComparisonCardModel | RankingCardModel | FoodPostCardModel;
  filenameBase: string;
  shareImageFormat?: ShareFormat;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<ShareFormat | "share" | null>(null);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(model.url);
      toast.success(t("link_copied"));
    } catch {
      toast.error(t("error_generic"));
    }
  };

  const nativeShare = async () => {
    setBusy("share");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (shareImageFormat) {
          const { renderShareCard } = await import("@/lib/share-card-canvas");
          const blob = await renderShareCard(model, shareImageFormat);
          if (blob) {
            const file = new File([blob], `${filenameBase}-${shareImageFormat}.png`, {
              type: "image/png",
            });
            if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                text: shareText(model),
                url: model.url,
              });
              return;
            }
          }
        }
        await navigator.share({ text: shareText(model), url: model.url });
        return;
      }
      await copyLink();
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      // AbortError / NotAllowedError = the diner dismissed the sheet or the
      // popup was blocked. Fall back to the clipboard, never show an error.
      if (name === "AbortError") return;
      await copyLink();
    } finally {
      setBusy(null);
    }
  };

  const download = async (format: ShareFormat) => {
    setBusy(format);
    try {
      const { renderShareCard, downloadBlob } = await import("@/lib/share-card-canvas");
      const blob = await renderShareCard(model, format);
      if (!blob) {
        toast.error(t("image_failed"));
        return;
      }
      downloadBlob(blob, `${filenameBase}-${format}.png`);
      toast.success(t("image_saved"));
    } catch {
      toast.error(t("image_failed"));
    } finally {
      setBusy(null);
    }
  };

  const downloads: Array<[ShareFormat, string]> = [
    ["story", t("download_story")],
    ["post", t("download_post")],
    ["square", t("download_square")],
  ];

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={nativeShare}
        disabled={busy === "share"}
        className="min-h-11 gap-2"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t("share")}
      </Button>
      <Button type="button" variant="outline" onClick={copyLink} className="min-h-11 gap-2">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {t("copy_link")}
      </Button>
      {downloads.map(([format, label]) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          onClick={() => download(format)}
          disabled={busy === format}
          aria-label={`${label} (${SHARE_FORMATS[format].label})`}
          className="min-h-11 gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {label}
          <span className="text-[10px] font-bold text-muted-foreground">
            {SHARE_FORMATS[format].label}
          </span>
        </Button>
      ))}
    </div>
  );
}

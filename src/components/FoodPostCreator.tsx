import { useMemo, useState } from "react";
import { Facebook, Instagram, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ShareCardActions } from "@/components/ShareCardActions";
import { useI18n } from "@/lib/i18n";
import { buildFoodPostCard, shareText, type FoodPostMode, type ShareDish } from "@/lib/share-card";
import type { Bilingual } from "@/lib/names";

type FoodPostDish = ShareDish & {
  price_thb?: number | null;
  place?: {
    name?: string | null;
    area?: Bilingual | null;
  } | null;
};

export function FoodPostCreator({
  dish,
  url,
  isTried,
  isSaved,
}: {
  dish: FoodPostDish;
  url: string;
  isTried: boolean;
  isSaved: boolean;
}) {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const [mode, setMode] = useState<FoodPostMode>(isTried ? "tried" : isSaved ? "saved" : "find");
  const [sharing, setSharing] = useState<"instagram" | "facebook" | null>(null);

  const options = useMemo(
    () =>
      [
        { mode: "find" as const, label: t("food_post_find"), enabled: true },
        { mode: "tried" as const, label: t("food_post_tried"), enabled: isTried },
        { mode: "saved" as const, label: t("food_post_saved"), enabled: isSaved },
      ].filter((option) => option.enabled),
    [isSaved, isTried, t],
  );

  const activeMode = options.some((option) => option.mode === mode) ? mode : options[0].mode;
  const model = buildFoodPostCard({ lang, dish, mode: activeMode, url });

  const shareToInstagram = async () => {
    setSharing("instagram");
    try {
      const { renderShareCard, downloadBlob } = await import("@/lib/share-card-canvas");
      const blob = await renderShareCard(model, "post");
      if (!blob) throw new Error("Image could not be created");
      const file = new File([blob], `jaannee-food-${dish.id.slice(0, 8)}.png`, {
        type: "image/png",
      });
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], text: shareText(model), url: model.url });
        return;
      }
      downloadBlob(blob, file.name);
      toast.success(
        copy(
          "Post image saved. Open Instagram to share it.",
          "บันทึกรูปโพสต์แล้ว เปิด Instagram เพื่อแชร์ได้เลย",
        ),
      );
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== "AbortError") {
        toast.error(t("image_failed"));
      }
    } finally {
      setSharing(null);
    }
  };

  const shareToFacebook = async () => {
    setSharing("facebook");
    const popup = window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(model.url)}`,
      "_blank",
      "noopener,noreferrer,width=720,height=640",
    );
    if (!popup) {
      try {
        await navigator.clipboard.writeText(model.url);
        toast.success(t("link_copied"));
      } catch {
        toast.error(t("error_generic"));
      }
    }
    setSharing(null);
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 gap-2">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t("share")}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[92dvh] overflow-y-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <div className="mx-auto w-full max-w-2xl px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{t("food_post_title")}</DrawerTitle>
            <DrawerDescription>{t("food_post_body")}</DrawerDescription>
          </DrawerHeader>

          <div className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
            <div className="relative aspect-[4/3] bg-muted sm:aspect-[16/7]">
              {dish.photo_url ? (
                <img src={dish.photo_url} alt="" className="h-full w-full object-cover" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                  {model.kicker}
                </p>
                <p className="mt-2 font-display text-3xl">{model.dishName}</p>
                <p className="mt-1 text-sm text-white/75">
                  {[model.placeName, model.areaName].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {model.personalLabel}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("food_post_hint")}</p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t("food_post_title")}>
            {options.map((option) => (
              <Button
                key={option.mode}
                type="button"
                size="sm"
                variant={activeMode === option.mode ? "default" : "outline"}
                onClick={() => setMode(option.mode)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={shareToInstagram}
              disabled={sharing !== null}
              className="min-h-12 gap-2"
            >
              <Instagram className="h-5 w-5" aria-hidden="true" />
              Instagram
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={shareToFacebook}
              disabled={sharing !== null}
              className="min-h-12 gap-2"
            >
              <Facebook className="h-5 w-5" aria-hidden="true" />
              Facebook
            </Button>
          </div>

          <ShareCardActions
            model={model}
            filenameBase={`jaannee-food-${dish.id.slice(0, 8)}`}
            shareImageFormat="post"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

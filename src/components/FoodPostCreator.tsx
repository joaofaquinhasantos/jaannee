import { useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
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
import { buildFoodPostCard, type FoodPostMode, type ShareDish } from "@/lib/share-card";
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
  const [mode, setMode] = useState<FoodPostMode>(isTried ? "tried" : isSaved ? "saved" : "find");

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

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 gap-2">
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {t("create_food_post")}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{t("food_post_title")}</DrawerTitle>
            <DrawerDescription>{t("food_post_body")}</DrawerDescription>
          </DrawerHeader>

          <div className="mb-5 overflow-hidden rounded-lg border border-border bg-card">
            <div className="relative aspect-[4/3] bg-muted">
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

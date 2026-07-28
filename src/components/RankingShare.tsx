import { Share2 } from "lucide-react";
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
import { buildRankingCard, type ShareDish } from "@/lib/share-card";

export function RankingShare({ dish, rank }: { dish: ShareDish; rank: number }) {
  const { t, lang } = useI18n();
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://jaannee.lovable.app";
  const model = buildRankingCard({
    lang,
    dish,
    rank,
    url: `${origin}/dish/${dish.id}`,
  });

  if (!model) return null;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11 gap-2">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          {t("share_ranking")}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl px-4 pb-8">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>{t("share_ranking")}</DrawerTitle>
            <DrawerDescription>
              #{rank} · {model.dishName} · {model.comparisons} {model.comparisonsLabel}
            </DrawerDescription>
          </DrawerHeader>
          <ShareCardActions model={model} filenameBase={`jaannee-rank-${rank}-${dish.id.slice(0, 8)}`} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

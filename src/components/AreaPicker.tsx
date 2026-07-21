import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

function matchesArea(area: any, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [area.name_en, area.name_th, area.slug]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

export function AreaPicker({
  areas,
  value,
  onChange,
  lang,
}: {
  areas: any[];
  value?: string;
  onChange: (value: string, area: any) => void;
  lang: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => areas.filter((area) => matchesArea(area, query)), [areas, query]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-auto min-h-9 w-full justify-between rounded-md border-border bg-card px-3 py-1.5 text-left text-xs font-semibold"
      >
        <span className="text-muted-foreground">{t("more_areas")}</span>
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-4 py-4">
            <DialogTitle>{t("more_areas")}</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border p-4">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_areas")}
            />
          </div>
          <div className="max-h-[60dvh] overflow-y-auto p-2">
            <div className="space-y-1">
              {matches.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => {
                    onChange(area.slug, area);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring ${
                    value === area.slug ? "bg-secondary" : ""
                  }`}
                >
                  <span className="font-semibold">{lang === "th" ? area.name_th : area.name_en}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{area.slug}</span>
                </button>
              ))}
            </div>
            {matches.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("no_matching_areas")}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

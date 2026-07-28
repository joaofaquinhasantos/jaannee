import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listMyRetention,
  markNotificationRead,
  saveDishCollection,
  saveRetentionPreferences,
} from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { useAuthUser } from "@/lib/use-auth";

type ProfileCounts = {
  posted: number;
  tried: number;
  compared: number;
  saved: Array<any>;
};

export function RetentionSuite({ counts }: { counts: ProfileCounts }) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const { userId } = useAuthUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"taste" | "inbox" | "plans">("taste");
  const [collectionName, setCollectionName] = useState("");
  const [dishId, setDishId] = useState("");
  const q = useQuery({
    queryKey: ["retention", userId],
    queryFn: () => listMyRetention(),
    enabled: Boolean(userId),
  });
  const data = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["retention", userId] });

  const preferences = useMutation({
    mutationFn: (next: { weeklyDigest: boolean; challengeNotifications: boolean }) =>
      saveRetentionPreferences({ data: next }),
    onSuccess: () => {
      refresh();
      toast.success(copy("Preferences saved", "บันทึกการตั้งค่าแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const collection = useMutation({
    mutationFn: (input: { name: string; kind: "custom" | "weekend"; dishId?: string }) =>
      saveDishCollection({ data: input }),
    onSuccess: () => {
      setCollectionName("");
      setDishId("");
      refresh();
      toast.success(copy("Plan saved", "บันทึกแผนแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const read = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead({ data: { notificationId } }),
    onSuccess: refresh,
  });

  const recap = useMemo(
    () =>
      copy(
        `My Bangkok taste on JaanNee: ${counts.tried} dishes tried, ${counts.compared} comparisons, and ${counts.posted} food posts. Rank the dish, not the restaurant.`,
        `รสนิยมอาหารกรุงเทพฯ ของฉันบน JaanNee: เคยกิน ${counts.tried} จาน เปรียบเทียบ ${counts.compared} ครั้ง และโพสต์อาหาร ${counts.posted} โพสต์ จัดอันดับจาน ไม่ใช่ร้าน`,
      ),
    [copy, counts.compared, counts.posted, counts.tried],
  );

  if (q.isLoading || !data?.available) return null;
  const unread = data.notifications.filter((item: any) => !item.read_at).length;
  const prefs = data.preferences;

  const shareRecap = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "My JaanNee taste", text: recap, url: location.href });
      else {
        await navigator.clipboard.writeText(`${recap}\n${location.href}`);
        toast.success(copy("Taste recap copied", "คัดลอกสรุปรสนิยมแล้ว"));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(copy("Could not share the recap", "ไม่สามารถแชร์สรุปได้"));
    }
  };

  return (
    <section className="mt-7 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex overflow-x-auto border-b border-border">
        <Tab active={tab === "taste"} onClick={() => setTab("taste")} icon={<Sparkles size={16} />}>
          {copy("My taste", "รสนิยมของฉัน")}
        </Tab>
        <Tab active={tab === "inbox"} onClick={() => setTab("inbox")} icon={<Bell size={16} />}>
          {copy("Inbox", "กล่องข้อความ")}{unread ? ` · ${unread}` : ""}
        </Tab>
        <Tab active={tab === "plans"} onClick={() => setTab("plans")} icon={<CalendarDays size={16} />}>
          {copy("Food plans", "แผนกิน")}
        </Tab>
      </div>

      {tab === "taste" ? (
        <div className="p-5 md:p-6">
          <p className="editorial-kicker text-primary">{copy("Your food identity", "ตัวตนด้านอาหารของคุณ")}</p>
          <h2 className="type-section-title mt-2">{copy("My Bangkok taste", "รสนิยมอาหารกรุงเทพฯ ของฉัน")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{recap}</p>
          <Button type="button" onClick={shareRecap} className="mt-5 min-h-11 gap-2">
            <Share2 size={16} /> {copy("Share my taste", "แชร์รสนิยมของฉัน")}
          </Button>
        </div>
      ) : null}

      {tab === "inbox" ? (
        <div className="p-5 md:p-6">
          <h2 className="type-section-title">{copy("What changed", "มีอะไรใหม่")}</h2>
          {data.notifications.length ? (
            <ul className="mt-4 divide-y divide-border">
              {data.notifications.map((item: any) => (
                <li key={item.id} className={`py-4 ${item.read_at ? "opacity-65" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      {item.body ? <p className="mt-1 text-sm text-muted-foreground">{item.body}</p> : null}
                    </div>
                    {!item.read_at ? (
                      <Button variant="ghost" size="sm" onClick={() => read.mutate(item.id)}>
                        {copy("Mark read", "อ่านแล้ว")}
                      </Button>
                    ) : null}
                  </div>
                  {item.href ? <Link to={item.href as "/"} className="mt-2 inline-block text-sm font-semibold text-primary">{copy("Open", "เปิด")}</Link> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{copy("Nothing new yet.", "ยังไม่มีรายการใหม่")}</p>
          )}
          <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
            <Preference
              label={copy("Weekly in-app recap", "สรุปรายสัปดาห์ในแอป")}
              checked={prefs.weekly_digest}
              onChange={(weeklyDigest) =>
                preferences.mutate({ weeklyDigest, challengeNotifications: prefs.challenge_notifications })
              }
            />
            <Preference
              label={copy("Challenge replies", "การตอบกลับคำท้า")}
              checked={prefs.challenge_notifications}
              onChange={(challengeNotifications) =>
                preferences.mutate({ weeklyDigest: prefs.weekly_digest, challengeNotifications })
              }
            />
          </div>
        </div>
      ) : null}

      {tab === "plans" ? (
        <div className="p-5 md:p-6">
          <h2 className="type-section-title">{copy("Plan your next food run", "วางแผนตะลุยกินครั้งต่อไป")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy("Turn saved dishes into a weekend list or your own collection.", "เปลี่ยนจานที่บันทึกไว้เป็นลิสต์สุดสัปดาห์หรือคอลเลกชันของคุณ")}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder={copy("Collection name", "ชื่อคอลเลกชัน")} />
            <select className="min-h-11 rounded-md border border-border bg-background px-3 text-sm" value={dishId} onChange={(e) => setDishId(e.target.value)}>
              <option value="">{copy("Add a saved dish later", "เพิ่มจานที่บันทึกไว้ภายหลัง")}</option>
              {counts.saved.map((dish: any) => <option key={dish.id} value={dish.id}>{localizedName(dish, lang)}</option>)}
            </select>
            <Button disabled={!collectionName.trim()} onClick={() => collection.mutate({ name: collectionName.trim(), kind: "custom", dishId: dishId || undefined })}>
              {copy("Create", "สร้าง")}
            </Button>
          </div>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => collection.mutate({ name: copy("This weekend", "สุดสัปดาห์นี้"), kind: "weekend", dishId: dishId || undefined })}>
            {copy("Make a weekend plan", "สร้างแผนสุดสัปดาห์")}
          </Button>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {data.collections.map((item: any) => (
              <article key={item.id} className="rounded-md border border-border bg-secondary/30 p-4">
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {item.items?.length ?? 0} {copy("dishes", "จาน")}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-semibold ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{icon}{children}</button>;
}

function Preference({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-semibold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-primary" /></label>;
}

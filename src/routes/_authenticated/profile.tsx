import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { DishCard } from "@/components/DishCard";
import { ReadyToComparePanel } from "@/components/ContextualCompare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { myProfile, updateMyProfile } from "@/lib/dishes.functions";
import { useI18n } from "@/lib/i18n";
import { localizedName } from "@/lib/names";
import { useAuthUser } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Your JaanNee profile" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: Profile,
});

function Profile() {
  const { t, lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { userId } = useAuthUser();
  const q = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => myProfile(),
    enabled: Boolean(userId),
  });
  const tried = (q.data?.tried ?? []).map((row: { dish?: unknown }) => row.dish).filter(Boolean);
  const wantToTry = (q.data?.want_to_try ?? [])
    .map((row: { dish?: unknown }) => row.dish)
    .filter(Boolean);
  const compared = q.data?.compared ?? [];
  const posted = q.data?.posted ?? [];
  const profile = q.data?.profile;
  const displayName =
    profile?.display_name || profile?.username || copy("Your profile", "โปรไฟล์ของคุณ");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [triedPublic, setTriedPublic] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setName(profile.display_name ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setBio(profile.bio ?? "");
    setTriedPublic(profile.tried_public !== false);
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateMyProfile({
        data: {
          username,
          displayName: name,
          avatarUrl,
          bio,
          triedPublic,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(copy("Profile saved", "บันทึกโปรไฟล์แล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/", replace: true });
  };

  const invalidUsername = username.trim().length > 0 && username.trim().length < 3;

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5 md:pb-7">
        <div>
          <p className="text-xs font-bold uppercase text-primary">{t("my_jaannee")}</p>
          <h1 className="type-page-title mt-2">{displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("profile_history_body")}</p>
        </div>
        <Button variant="ghost" onClick={signOut} className="min-h-11">
          {t("sign_out")}
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg border border-border bg-card p-3 text-center">
        <Stat label={t("profile_posts")} value={posted.length} />
        <Stat label={t("profile_tried")} value={tried.length} />
        <Stat label={t("profile_comparisons")} value={compared.length} />
        <Stat label={copy("Followers", "ผู้ติดตาม")} value={q.data?.followers_count ?? 0} />
      </div>

      <div className="mt-6">
        <ReadyToComparePanel />
      </div>

      <section className="mt-8 rounded-lg border border-border bg-secondary/35 p-4 md:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
          {copy("Plan your next meal", "วางแผนมื้อต่อไป")}
        </p>
        <h2 className="type-section-title mt-2">{t("want_to_try")}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("want_to_try_body")}
        </p>
        {wantToTry.length === 0 ? (
          <div className="mt-5">
            <EmptyNote text={t("no_saved_dishes")} />
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {wantToTry.map((dish: any) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="type-section-title mb-4">{t("profile_tried")}</h2>
        {tried.length === 0 ? (
          <EmptyNote
            text={copy("No dishes marked tried yet.", "ยังไม่มีจานที่ทำเครื่องหมายว่าเคยกิน")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tried.map((dish: any) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="type-section-title mb-4">{t("profile_submitted")}</h2>
        {posted.length === 0 ? (
          <EmptyNote text={copy("No submitted dishes yet.", "ยังไม่มีจานที่ส่งไว้")} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posted.map((dish: any) =>
              dish.status === "approved" ? (
                <DishCard key={dish.id} dish={dish} />
              ) : (
                <PrivateSubmissionCard key={dish.id} dish={dish} />
              ),
            )}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="type-section-title mb-4">{t("profile_comparisons")}</h2>
        {compared.length === 0 ? (
          <EmptyNote text={copy("No comparisons yet.", "ยังไม่มีการเปรียบเทียบ")} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {compared.map((comparison: any) => (
              <li
                key={comparison.id}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4 text-sm"
              >
                <ComparisonDish
                  dish={comparison.lo}
                  winner={comparison.winner_id === comparison.lo?.id}
                />
                <span className="text-xs font-bold uppercase text-muted-foreground">VS</span>
                <ComparisonDish
                  dish={comparison.hi}
                  winner={comparison.winner_id === comparison.hi?.id}
                  align="right"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-border bg-card p-4 md:p-5">
        <h2 className="type-section-title">{t("profile_settings")}</h2>
        {!profile?.username ? (
          <div className="mt-4 rounded-md bg-secondary p-3 text-sm">
            {copy(
              "Claim a username to make your public profile visible. Until then, it remains private.",
              "ตั้งชื่อผู้ใช้เพื่อเปิดโปรไฟล์สาธารณะ จนกว่าจะตั้ง โปรไฟล์จะยังเป็นส่วนตัว",
            )}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            <span>{copy("Username", "ชื่อผู้ใช้")}</span>
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value.toLowerCase())}
              placeholder="joao_eats"
              aria-invalid={invalidUsername}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>{copy("Name", "ชื่อ")}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm font-semibold md:col-span-2">
            <span>{copy("Avatar URL", "ลิงก์รูปโปรไฟล์")}</span>
            <Input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1 text-sm font-semibold md:col-span-2">
            <span>{copy("Bio", "แนะนำตัว")}</span>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={160}
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-semibold md:col-span-2">
            <span>
              {copy("Show dishes I tried on my public profile", "แสดงจานที่เคยกินในโปรไฟล์สาธารณะ")}
            </span>
            <input
              type="checkbox"
              checked={triedPublic}
              onChange={(event) => setTriedPublic(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending || invalidUsername}
            className="min-h-11"
          >
            {copy("Save profile", "บันทึกโปรไฟล์")}
          </Button>
          {profile?.username ? (
            <Link to="/u/$username" params={{ username: profile.username }}>
              <Button variant="outline" className="min-h-11">
                {copy("View public profile", "ดูโปรไฟล์สาธารณะ")}
              </Button>
            </Link>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function PrivateSubmissionCard({ dish }: { dish: any }) {
  const { lang, t } = useI18n();
  const name = localizedName(dish, lang);
  const pending = dish.status === "pending";
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="aspect-[4/3] bg-muted">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={name}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
          {pending ? t("pending_review") : t("not_approved")}
        </p>
        <h3 className="mt-2 font-display text-2xl">{name}</h3>
        {dish.place?.name ? (
          <p className="mt-1 text-sm text-muted-foreground">{dish.place.name}</p>
        ) : null}
      </div>
    </article>
  );
}

function ComparisonDish({
  dish,
  winner,
  align = "left",
}: {
  dish: any;
  winner: boolean;
  align?: "left" | "right";
}) {
  const { lang } = useI18n();
  return (
    <span
      className={`${winner ? "font-semibold" : "text-muted-foreground"} ${align === "right" ? "text-right" : ""}`}
    >
      {localizedName(dish, lang)}
      {dish?.place?.name ? (
        <span className="block text-xs font-normal text-muted-foreground">{dish.place.name}</span>
      ) : null}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="type-stat">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

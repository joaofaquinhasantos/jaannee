import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { myProfile, updateMyProfile } from "@/lib/dishes.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { DishCard } from "@/components/DishCard";
import { InlineTriedCompare } from "@/components/InlineTriedCompare";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your JaanNee profile" },
      {
        name: "description",
        content:
          "Manage your JaanNee profile: display name, username, avatar, bio, and the dishes you have tried, posted, and compared as a diner.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Your JaanNee profile" },
      {
        property: "og:description",
        content: "Manage your JaanNee profile and see your tried, posted, and compared dishes.",
      },
      { property: "og:url", content: "https://jaannee.lovable.app/profile" },
    ],
    links: [{ rel: "canonical", href: "https://jaannee.lovable.app/profile" }],
  }),
  component: Profile,
});

function Profile() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => myProfile() });
  const tried = useMemo(
    () => (q.data?.tried ?? []).map((r: any) => r.dish).filter(Boolean),
    [q.data?.tried],
  );
  const compared = useMemo(() => q.data?.compared ?? [], [q.data?.compared]);
  const posted = q.data?.posted ?? [];
  const profile = q.data?.profile;
  const displayName =
    profile?.display_name || profile?.username || (lang === "th" ? "โปรไฟล์ของคุณ" : "Your profile");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [triedPublic, setTriedPublic] = useState(true);

  const readyPair = useMemo(() => {
    const comparedKeys = new Set(
      compared
        .map((comparison: any) => {
          const loId = comparison.lo?.id;
          const hiId = comparison.hi?.id;
          if (!loId || !hiId) return null;
          return [loId, hiId].sort().join(":");
        })
        .filter(Boolean),
    );

    for (let i = 0; i < tried.length; i += 1) {
      for (let j = i + 1; j < tried.length; j += 1) {
        const a = tried[i];
        const b = tried[j];
        if (!a?.id || !b?.id || a.category?.id !== b.category?.id) continue;
        const aSubtype = a.subtype_id ?? a.subtype?.id ?? null;
        const bSubtype = b.subtype_id ?? b.subtype?.id ?? null;
        if (aSubtype !== bSubtype) continue;
        const key = [a.id, b.id].sort().join(":");
        if (comparedKeys.has(key)) continue;
        return [a, b] as const;
      }
    }
    return null;
  }, [tried, compared]);

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
      toast.success(lang === "th" ? "บันทึกโปรไฟล์แล้ว" : "Profile saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    nav({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5 md:pb-7">
        <div>
          <p className="text-xs font-bold uppercase text-primary">
            {lang === "th" ? "เส้นทางรสนิยมของคุณ" : "Your taste trail"}
          </p>
          <h1 className="type-page-title mt-2">{displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("profile_history_body")}</p>
        </div>
        <Button variant="ghost" onClick={signOut}>
          {t("sign_out")}
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg border border-border bg-card p-3 text-center">
        <Stat label={t("profile_posts")} value={posted.length} />
        <Stat label={t("profile_tried")} value={tried.length} />
        <Stat label={t("profile_comparisons")} value={compared.length} />
        <Stat label={lang === "th" ? "ผู้ติดตาม" : "Followers"} value={q.data?.followers_count ?? 0} />
      </div>

      {readyPair ? (
        <section className="mt-6 rounded-lg border-2 border-primary/40 bg-primary/5 p-4 md:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t("which_better")}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("compare_page_intro")}
          </p>
          <InlineTriedCompare dish={readyPair[0]} other={readyPair[1]} />
        </section>
      ) : null}

      <section className="mt-6 rounded-lg border border-border bg-card p-4 md:p-5">
        {!profile?.username ? (
          <div className="mb-4 rounded-md bg-secondary p-3 text-sm">
            {lang === "th"
              ? "ตั้งชื่อผู้ใช้เพื่อเปิดโปรไฟล์สาธารณะ ก่อนหน้านั้นโปรไฟล์ของคุณจะเป็นส่วนตัว"
              : "Claim a username to make your public profile visible. Until then, your profile stays private."}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            <span>{lang === "th" ? "ชื่อผู้ใช้" : "Username"}</span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="joao_eats"
            />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>{lang === "th" ? "ชื่อ" : "Name"}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Joao" />
          </label>
          <label className="space-y-1 text-sm font-semibold md:col-span-2">
            <span>{lang === "th" ? "ลิงก์รูปโปรไฟล์" : "Avatar URL"}</span>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="space-y-1 text-sm font-semibold md:col-span-2">
            <span>{lang === "th" ? "แนะนำตัว" : "Bio"}</span>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder={lang === "th" ? "คุณเป็นนักชิมแบบไหน?" : "What kind of eater are you?"}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm font-semibold md:col-span-2">
            <span>
              {lang === "th"
                ? "แสดงจานที่ฉันเคยกินในโปรไฟล์สาธารณะ"
                : "Show dishes I tried on my public profile"}
            </span>
            <input
              type="checkbox"
              checked={triedPublic}
              onChange={(e) => setTriedPublic(e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending || username.trim().length < 3}
          >
            {lang === "th" ? "บันทึกโปรไฟล์" : "Save profile"}
          </Button>
          {profile?.username ? (
            <Link to="/u/$username" params={{ username: profile.username }}>
              <Button variant="outline">
                {lang === "th" ? "ดูโปรไฟล์สาธารณะ" : "View public profile"}
              </Button>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="type-section-title mb-4">{t("profile_posts")}</h2>
        {posted.length === 0 ? (
          <EmptyNote text={lang === "th" ? "ยังไม่มีโพสต์" : "No posts yet."} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posted.map((d: any) => (
              <DishCard key={d.id} dish={d} linkToDetail={d.status === "approved"} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="type-section-title mb-4">{t("profile_tried")}</h2>
        {tried.length === 0 ? (
          <EmptyNote
            text={lang === "th" ? "ยังไม่มีจานที่ทำเครื่องหมายว่าเคยกิน" : "No dishes marked tried yet."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tried.map((d: any) => (
              <DishCard key={d.id} dish={d} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="type-section-title mb-4">{t("profile_comparisons")}</h2>
        {compared.length === 0 ? (
          <EmptyNote text={lang === "th" ? "ยังไม่มีการเปรียบเทียบ" : "No comparisons yet."} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {compared.map((c: any) => {
              const loName = lang === "th" && c.lo?.name_th ? c.lo.name_th : c.lo?.name_en;
              const hiName = lang === "th" && c.hi?.name_th ? c.hi.name_th : c.hi?.name_en;
              return (
                <li key={c.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <span
                    className={c.winner_id === c.lo?.id ? "font-medium" : "text-muted-foreground"}
                  >
                    {loName}{" "}
                    <span className="text-xs text-muted-foreground">({c.lo?.place?.name})</span>
                  </span>
                  <span className="text-muted-foreground">{lang === "th" ? "เทียบกับ" : "vs"}</span>
                  <span
                    className={c.winner_id === c.hi?.id ? "font-medium" : "text-muted-foreground"}
                  >
                    {hiName}{" "}
                    <span className="text-xs text-muted-foreground">({c.hi?.place?.name})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
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

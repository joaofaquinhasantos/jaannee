import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Gift,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyRestaurantWorkspace,
  listClaimablePlaces,
  sendRestaurantOutreach,
  submitRestaurantClaim,
  updateRestaurantProfile,
} from "@/lib/restaurant.functions";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/restaurant")({
  head: () => ({
    meta: [
      { title: "Restaurant workspace — JaanNee" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RestaurantWorkspace,
});

function RestaurantWorkspace() {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const { userId } = useAuthUser();
  const qc = useQueryClient();
  const workspace = useQuery({
    queryKey: ["restaurant-workspace", userId],
    queryFn: () => getMyRestaurantWorkspace(),
    enabled: Boolean(userId),
  });
  const restaurants = workspace.data?.restaurants ?? [];
  const [showDemo, setShowDemo] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  useEffect(() => {
    if (!selectedPlaceId && restaurants[0]?.place_id) setSelectedPlaceId(restaurants[0].place_id);
  }, [restaurants, selectedPlaceId]);
  const selected = restaurants.find((item: any) => item.place_id === selectedPlaceId) ?? restaurants[0];

  if (workspace.isLoading) {
    return <AppShell><p className="text-muted-foreground">{copy("Loading restaurant workspace…", "กำลังโหลดพื้นที่ร้าน…")}</p></AppShell>;
  }
  if (workspace.data?.available === false) {
    return (
      <AppShell>
        <section className="mx-auto max-w-xl py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="type-page-title mt-4">{copy("Restaurant profiles are almost ready", "โปรไฟล์ร้านใกล้พร้อมแล้ว")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{copy("The owner must finish the secure database setup first.", "เจ้าของระบบต้องตั้งค่าฐานข้อมูลที่ปลอดภัยให้เสร็จก่อน")}</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="border-b border-border pb-7">
        <p className="editorial-kicker text-primary">{copy("JaanNee for restaurants", "JaanNee สำหรับร้านอาหาร")}</p>
        <h1 className="type-page-title mt-3 max-w-4xl">
          {copy("Turn genuine diner interest into return visits", "เปลี่ยนความสนใจจริงจากนักชิมให้กลายเป็นการกลับมาอีก")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {copy(
            "Own your official information, share your menu and send thoughtful messages or gift vouchers only to diners who explicitly invite contact. Rankings remain completely independent.",
            "จัดการข้อมูลทางการ แชร์เมนู และส่งข้อความหรือบัตรกำนัลเฉพาะให้นักชิมที่อนุญาต อันดับยังคงเป็นอิสระโดยสิ้นเชิง",
          )}
        </p>
      </section>

      {showDemo ? (
        <DemoRestaurant onExit={() => setShowDemo(false)} />
      ) : restaurants.length ? (
        <>
          {restaurants.length > 1 ? (
            <select value={selectedPlaceId} onChange={(e) => setSelectedPlaceId(e.target.value)} className="mt-6 min-h-11 rounded-md border border-border bg-card px-3">
              {restaurants.map((item: any) => <option key={item.place_id} value={item.place_id}>{item.place?.name}</option>)}
            </select>
          ) : null}
          {selected ? <VerifiedRestaurantPanel key={selected.place_id} restaurant={selected} /> : null}
        </>
      ) : (
        <RestaurantClaimPanel
          claims={workspace.data?.claims ?? []}
          onPreview={() => setShowDemo(true)}
        />
      )}
    </AppShell>
  );
}

function RestaurantClaimPanel({
  claims,
  onPreview,
}: {
  claims: any[];
  onPreview: () => void;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [role, setRole] = useState("");
  const [proof, setProof] = useState("");
  const places = useQuery({
    queryKey: ["claimable-places", search],
    queryFn: () => listClaimablePlaces({ data: { query: search } }),
    enabled: search.trim().length >= 2,
  });
  const claim = useMutation({
    mutationFn: () =>
      submitRestaurantClaim({
        data: { placeId, businessRole: role, verificationNote: proof },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      toast.success(copy("Claim sent for verification", "ส่งคำขอยืนยันร้านแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-7 space-y-7">
      <section className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
        {[
          {
            Icon: BadgeCheck,
            title: copy("Verified presence", "ตัวตนร้านที่ยืนยัน"),
            body: copy(
              "Publish your official story, menu and contact details beside diner-created dishes.",
              "เผยแพร่เรื่องราว เมนู และช่องทางติดต่อทางการข้างจานที่นักชิมเพิ่ม",
            ),
          },
          {
            Icon: Users,
            title: copy("Permission-based audience", "กลุ่มนักชิมที่อนุญาต"),
            body: copy(
              "Reach only diners who tried or want your dishes and separately opted in.",
              "ติดต่อเฉพาะผู้ที่เคยลองหรืออยากลองจานของคุณและยินยอมแยกต่างหาก",
            ),
          },
          {
            Icon: Gift,
            title: copy("Messages & gifts", "ข้อความและของขวัญ"),
            body: copy(
              "Send personal invitations and trackable gift vouchers without spam.",
              "ส่งคำเชิญและบัตรกำนัลส่วนบุคคลโดยไม่รบกวน",
            ),
          },
        ].map(({ Icon, title, body }) => (
          <div key={title} className="bg-card p-5 md:p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h2 className="mt-4 font-display text-2xl uppercase">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 rounded-lg border border-primary/40 bg-primary/5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
        <div>
          <p className="editorial-kicker text-primary">
            {copy("Founding restaurant pilot", "โครงการร้านรุ่นก่อตั้ง")}
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase md:text-4xl">
            {copy("One complete restaurant plan", "แผนร้านอาหารแบบครบวงจร")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {copy(
              "Verification comes first. Subscription payment follows approval, before the live workspace is activated. No card is charged during the claim.",
              "ยืนยันร้านก่อน จากนั้นจึงชำระค่าสมาชิกก่อนเปิดใช้พื้นที่ร้าน จะไม่มีการตัดบัตรในขณะส่งคำขอ",
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold uppercase">
            <span>✓ {copy("Official profile", "โปรไฟล์ทางการ")}</span>
            <span>✓ {copy("Consented messaging", "ข้อความที่ยินยอม")}</span>
            <span>✓ {copy("Gift vouchers", "บัตรกำนัล")}</span>
          </div>
        </div>
        <Button size="lg" className="gap-2" variant="outline" onClick={onPreview}>
          <Sparkles size={18} />
          {copy("Preview full workspace", "ดูตัวอย่างพื้นที่ร้าน")}
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          [copy("1. Claim", "1. ส่งคำขอ"), copy("Select your existing restaurant.", "เลือกร้านที่มีอยู่")],
          [copy("2. Verify", "2. ยืนยัน"), copy("JaanNee confirms your authority.", "JaanNee ยืนยันสิทธิ์ของคุณ")],
          [copy("3. Pay", "3. ชำระเงิน"), copy("Complete secure subscription checkout.", "ชำระค่าสมาชิกอย่างปลอดภัย")],
          [copy("4. Launch", "4. เปิดใช้"), copy("Your official workspace goes live.", "พื้นที่ร้านทางการเปิดใช้งาน")],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-border bg-card p-4">
            <p className="font-bold uppercase text-primary">{title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-lg border border-border bg-card p-5 md:p-6">
        <h2 className="type-section-title">{copy("Claim your restaurant", "ขอยืนยันร้านของคุณ")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{copy("Search for the existing JaanNee place. Claims are manually verified before access is granted.", "ค้นหาร้านที่มีอยู่ใน JaanNee คำขอจะได้รับการตรวจสอบก่อนอนุมัติ")}</p>
        <div className="mt-5 space-y-4">
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPlaceId(""); }} placeholder={copy("Search restaurant name", "ค้นหาชื่อร้าน")} />
          {places.data?.length ? (
            <div className="max-h-56 overflow-y-auto rounded-md border border-border">
              {places.data.map((place: any) => (
                <button key={place.id} type="button" onClick={() => setPlaceId(place.id)} className={`block w-full border-b border-border p-3 text-left last:border-0 ${placeId === place.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                  <span className="font-semibold">{place.name}</span>
                  {place.address ? <span className="mt-1 block text-xs opacity-70">{place.address}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder={copy("Your role (owner, manager…)", "บทบาทของคุณ (เจ้าของ ผู้จัดการ…)")} />
          <Textarea value={proof} onChange={(e) => setProof(e.target.value)} placeholder={copy("Explain how we can verify you (business email, website, phone, company details…)", "อธิบายวิธียืนยันตัวตน (อีเมลธุรกิจ เว็บไซต์ โทรศัพท์ ข้อมูลบริษัท…)")} rows={5} />
          <Button disabled={!placeId || role.trim().length < 2 || proof.trim().length < 10 || claim.isPending} onClick={() => claim.mutate()}>
            {copy("Submit verification request", "ส่งคำขอยืนยัน")}
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-border bg-secondary/35 p-5">
        <h2 className="type-section-title">{copy("Your claims", "คำขอของคุณ")}</h2>
        {claims.length ? (
          <ul className="mt-4 space-y-3">
            {claims.map((item) => (
              <li key={item.id} className="rounded-md border border-border bg-card p-3">
                <p className="font-semibold">{item.place?.name}</p>
                <p className="mt-1 text-xs font-bold uppercase text-primary">{item.status}</p>
                {item.review_note ? <p className="mt-2 text-sm text-muted-foreground">{item.review_note}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">{copy("No claims submitted yet.", "ยังไม่มีคำขอ")}</p>}
      </section>
      </section>
    </div>
  );
}

function DemoRestaurant({ onExit }: { onExit: () => void }) {
  const demoRestaurant = {
    place_id: "demo",
    role: "owner",
    place: { name: "JaanNee Test Kitchen", address: "Thonglor, Bangkok" },
    profile: {
      official_description:
        "A sample restaurant workspace showing how verified restaurants can welcome interested diners without influencing JaanNee rankings.",
      menu_url: "https://example.com/menu",
      instagram_url: "https://instagram.com/",
      line_url: "",
      phone: "02 000 0000",
    },
    audience: [
      {
        user_id: "demo-diner-1",
        allow_messages: true,
        allow_vouchers: true,
        diner: { display_name: "Mali S.", username: "malieats" },
      },
      {
        user_id: "demo-diner-2",
        allow_messages: false,
        allow_vouchers: true,
        diner: { display_name: "Bangkok Bites", username: "bkkbites" },
      },
      {
        user_id: "demo-diner-3",
        allow_messages: true,
        allow_vouchers: false,
        diner: { display_name: "Nok", username: "noktries" },
      },
    ],
    sent: [],
  };

  return (
    <div className="mt-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 p-4">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-gold" />
          <div>
            <p className="font-bold uppercase">Demo workspace</p>
            <p className="text-xs text-muted-foreground">
              Sample data only. Saving and sending are disabled.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onExit}>Exit demo</Button>
      </div>
      <VerifiedRestaurantPanel restaurant={demoRestaurant} demo />
    </div>
  );
}

function VerifiedRestaurantPanel({
  restaurant,
  demo = false,
}: {
  restaurant: any;
  demo?: boolean;
}) {
  const { lang } = useI18n();
  const copy = (en: string, th: string) => (lang === "th" ? th : en);
  const qc = useQueryClient();
  const profile = restaurant.profile ?? {};
  const [description, setDescription] = useState(profile.official_description ?? "");
  const [menuUrl, setMenuUrl] = useState(profile.menu_url ?? "");
  const [lineUrl, setLineUrl] = useState(profile.line_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(profile.instagram_url ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [recipientId, setRecipientId] = useState("");
  const [kind, setKind] = useState<"message" | "voucher">("message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState("");
  const [expiry, setExpiry] = useState("");
  const audience = restaurant.audience ?? [];
  const selectedDiner = audience.find((item: any) => item.user_id === recipientId);
  useEffect(() => {
    if (!selectedDiner) return;
    if (kind === "message" && !selectedDiner.allow_messages && selectedDiner.allow_vouchers) {
      setKind("voucher");
    } else if (kind === "voucher" && !selectedDiner.allow_vouchers && selectedDiner.allow_messages) {
      setKind("message");
    }
  }, [kind, selectedDiner]);
  const save = useMutation({
    mutationFn: () => updateRestaurantProfile({ data: { placeId: restaurant.place_id, officialDescription: description, menuUrl, lineUrl, instagramUrl, phone } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["restaurant-workspace"] }); toast.success(copy("Official profile saved", "บันทึกโปรไฟล์ทางการแล้ว")); },
    onError: (error: Error) => toast.error(error.message),
  });
  const send = useMutation({
    mutationFn: () => sendRestaurantOutreach({ data: {
      placeId: restaurant.place_id,
      recipientUserId: recipientId,
      kind,
      subject,
      body,
      voucherCode: kind === "voucher" ? code : undefined,
      voucherTerms: kind === "voucher" ? terms : undefined,
      expiresAt: kind === "voucher" && expiry ? new Date(expiry).toISOString() : undefined,
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      setSubject(""); setBody(""); setCode(""); setTerms(""); setExpiry("");
      toast.success(copy("Sent to the consenting diner", "ส่งให้นักชิมที่อนุญาตแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-7 space-y-7">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary"><ShieldCheck size={16} /> {copy("Verified restaurant", "ร้านที่ยืนยันแล้ว")}</p>
          <h2 className="mt-2 font-display text-3xl">{restaurant.place?.name}</h2>
        </div>
        {!demo ? (
          <Link to="/place/$placeId" params={{ placeId: restaurant.place_id }}>
            <Button variant="outline">{copy("View public profile", "ดูโปรไฟล์สาธารณะ")}</Button>
          </Link>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="type-section-title">{copy("Official information", "ข้อมูลทางการ")}</h2>
          <div className="mt-4 space-y-3">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder={copy("Official restaurant description", "คำอธิบายร้านอย่างเป็นทางการ")} />
            <Input value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} placeholder={copy("Official menu URL", "ลิงก์เมนูทางการ")} />
            <Input value={lineUrl} onChange={(e) => setLineUrl(e.target.value)} placeholder="LINE URL" />
            <Input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="Instagram URL" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={copy("Phone", "โทรศัพท์")} />
            <Button onClick={() => save.mutate()} disabled={demo || save.isPending}>{copy("Save profile", "บันทึกโปรไฟล์")}</Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="type-section-title">{copy("Consenting diners", "นักชิมที่อนุญาต")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy("Only diners who marked one of your dishes and explicitly opted in appear here.", "แสดงเฉพาะนักชิมที่ทำเครื่องหมายจานของร้านและอนุญาตอย่างชัดเจน")}</p>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {audience.map((item: any) => {
              const name = item.diner?.display_name || item.diner?.username || copy("Private diner", "นักชิมส่วนตัว");
              return (
                <button key={item.user_id} type="button" onClick={() => setRecipientId(item.user_id)} className={`w-full rounded-md border p-3 text-left ${recipientId === item.user_id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <p className="font-semibold">{name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.allow_messages ? copy("Messages", "ข้อความ") : ""}{item.allow_messages && item.allow_vouchers ? " · " : ""}{item.allow_vouchers ? copy("Vouchers", "บัตรกำนัล") : ""}</p>
                </button>
              );
            })}
            {!audience.length ? <p className="text-sm text-muted-foreground">{copy("No diners have opted in yet.", "ยังไม่มีนักชิมอนุญาต")}</p> : null}
          </div>
        </section>
      </div>

      {selectedDiner ? (
        <section className="rounded-lg border border-border bg-secondary/30 p-5">
          <h2 className="type-section-title">{copy("Send manually", "ส่งด้วยตนเอง")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy("Messages are limited to one per 7 days; gift vouchers to one per 30 days for each diner.", "ข้อความจำกัด 1 ครั้งต่อ 7 วัน และบัตรกำนัล 1 ครั้งต่อ 30 วันต่อนักชิม")}</p>
          <div className="mt-4 flex gap-2">
            {selectedDiner.allow_messages ? <Button variant={kind === "message" ? "default" : "outline"} className="gap-2" onClick={() => setKind("message")}><MessageCircle size={16} /> {copy("Message", "ข้อความ")}</Button> : null}
            {selectedDiner.allow_vouchers ? <Button variant={kind === "voucher" ? "default" : "outline"} className="gap-2" onClick={() => setKind("voucher")}><Gift size={16} /> {copy("Gift voucher", "บัตรกำนัล")}</Button> : null}
          </div>
          <div className="mt-4 grid gap-3">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} placeholder={copy("Subject", "หัวข้อ")} />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder={copy("Write a respectful message", "เขียนข้อความอย่างสุภาพ")} />
            {kind === "voucher" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={copy("Voucher code", "รหัสบัตรกำนัล")} />
                <Input value={expiry} onChange={(e) => setExpiry(e.target.value)} type="datetime-local" />
                <Input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={copy("Terms", "เงื่อนไข")} />
              </div>
            ) : null}
            <Button className="w-fit" disabled={demo || !subject.trim() || !body.trim() || (kind === "voucher" && (!code.trim() || !expiry)) || send.isPending} onClick={() => send.mutate()}>
              {copy("Send", "ส่ง")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

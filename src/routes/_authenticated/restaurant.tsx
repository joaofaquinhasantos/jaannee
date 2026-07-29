import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Camera,
  Gift,
  Images,
  Info,
  LockKeyhole,
  MessageCircle,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoucherCard } from "@/components/VoucherCard";
import { supabase } from "@/integrations/supabase/client";
import {
  addRestaurantGalleryPhoto,
  createRestaurantUpdate,
  deleteRestaurantGalleryPhoto,
  deleteRestaurantUpdate,
  getMyRestaurantWorkspace,
  listClaimablePlaces,
  sendRestaurantOutreach,
  startRestaurantGrowthTrial,
  submitRestaurantClaim,
  updateRestaurantProfile,
} from "@/lib/restaurant.functions";
import { PHOTO_ACCEPT_ATTR, buildPhotoPath, validatePhotoFile } from "@/lib/photo-upload";
import { useAuthUser } from "@/lib/use-auth";
import { useI18n } from "@/lib/i18n";
import { generateVoucherNumber } from "@/lib/voucher";

export const Route = createFileRoute("/_authenticated/restaurant")({
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search.demo === true || search.demo === "true",
  }),
  head: () => ({
    meta: [
      { title: "Restaurant workspace — JaanNee" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RestaurantWorkspace,
});

function RestaurantWorkspace() {
  const { demo: openDemo } = Route.useSearch();
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
  const [showDemo, setShowDemo] = useState(openDemo);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  useEffect(() => {
    if (!selectedPlaceId && restaurants[0]?.place_id) setSelectedPlaceId(restaurants[0].place_id);
  }, [restaurants, selectedPlaceId]);
  const selected =
    restaurants.find((item: any) => item.place_id === selectedPlaceId) ?? restaurants[0];

  if (workspace.isLoading) {
    return (
      <AppShell tone="noir">
        <p className="text-muted-foreground">
          {copy("Loading restaurant workspace…", "กำลังโหลดพื้นที่ร้าน…")}
        </p>
      </AppShell>
    );
  }
  if (workspace.data?.available === false) {
    return (
      <AppShell tone="noir">
        <section className="mx-auto max-w-xl py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="type-page-title mt-4">
            {copy("Restaurant profiles are almost ready", "โปรไฟล์ร้านใกล้พร้อมแล้ว")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {copy(
              "The owner must finish the secure database setup first.",
              "เจ้าของระบบต้องตั้งค่าฐานข้อมูลที่ปลอดภัยให้เสร็จก่อน",
            )}
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell tone="noir">
      <section className="stitch-masthead">
        <div>
          <p className="stitch-kicker">
            {copy("JaanNee for restaurants", "JaanNee สำหรับร้านอาหาร")}
          </p>
          <h1 className="mt-3 max-w-4xl">
            {copy(
              "Turn genuine diner interest into return visits",
              "เปลี่ยนความสนใจจริงจากนักชิมให้กลายเป็นการกลับมาอีก",
            )}
          </h1>
        </div>
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
            <select
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
              className="mt-6 min-h-11 rounded-md border border-border bg-card px-3"
            >
              {restaurants.map((item: any) => (
                <option key={item.place_id} value={item.place_id}>
                  {item.place?.name}
                </option>
              ))}
            </select>
          ) : null}
          {selected ? (
            <VerifiedRestaurantPanel key={selected.place_id} restaurant={selected} />
          ) : null}
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

function RestaurantClaimPanel({ claims, onPreview }: { claims: any[]; onPreview: () => void }) {
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
      <section className="stitch-card-grid">
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
          [
            copy("1. Claim", "1. ส่งคำขอ"),
            copy("Select your existing restaurant.", "เลือกร้านที่มีอยู่"),
          ],
          [
            copy("2. Verify", "2. ยืนยัน"),
            copy("JaanNee confirms your authority.", "JaanNee ยืนยันสิทธิ์ของคุณ"),
          ],
          [
            copy("3. Pay", "3. ชำระเงิน"),
            copy("Complete secure subscription checkout.", "ชำระค่าสมาชิกอย่างปลอดภัย"),
          ],
          [
            copy("4. Launch", "4. เปิดใช้"),
            copy("Your official workspace goes live.", "พื้นที่ร้านทางการเปิดใช้งาน"),
          ],
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-border bg-card p-4">
            <p className="font-bold uppercase text-primary">{title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-border bg-card p-5 md:p-6">
          <h2 className="type-section-title">
            {copy("Claim your restaurant", "ขอยืนยันร้านของคุณ")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy(
              "Search for the existing JaanNee place. Claims are manually verified before access is granted.",
              "ค้นหาร้านที่มีอยู่ใน JaanNee คำขอจะได้รับการตรวจสอบก่อนอนุมัติ",
            )}
          </p>
          <div className="mt-5 space-y-4">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPlaceId("");
              }}
              placeholder={copy("Search restaurant name", "ค้นหาชื่อร้าน")}
            />
            {places.data?.length ? (
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                {places.data.map((place: any) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setPlaceId(place.id)}
                    className={`block w-full border-b border-border p-3 text-left last:border-0 ${placeId === place.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  >
                    <span className="font-semibold">{place.name}</span>
                    {place.address ? (
                      <span className="mt-1 block text-xs opacity-70">{place.address}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={copy("Your role (owner, manager…)", "บทบาทของคุณ (เจ้าของ ผู้จัดการ…)")}
            />
            <Textarea
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              placeholder={copy(
                "Explain how we can verify you (business email, website, phone, company details…)",
                "อธิบายวิธียืนยันตัวตน (อีเมลธุรกิจ เว็บไซต์ โทรศัพท์ ข้อมูลบริษัท…)",
              )}
              rows={5}
            />
            <Button
              disabled={
                !placeId || role.trim().length < 2 || proof.trim().length < 10 || claim.isPending
              }
              onClick={() => claim.mutate()}
            >
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
                  {item.review_note ? (
                    <p className="mt-2 text-sm text-muted-foreground">{item.review_note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {copy("No claims submitted yet.", "ยังไม่มีคำขอ")}
            </p>
          )}
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
      reservation_url: "https://example.com/book",
      instagram_url: "https://instagram.com/",
      line_url: "",
      phone: "02 000 0000",
      subscription_tier: "growth",
      subscription_status: "trialing",
      trial_ends_at: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
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
    gallery: [],
    updates: [
      {
        id: "demo-update-1",
        title: "Friday chef's counter seats",
        body: "Four seats just opened for this Friday's seasonal tasting menu.",
      },
      {
        id: "demo-update-2",
        title: "New mango dessert",
        body: "Our summer mango and coconut dessert is now available after 6pm.",
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
        <Button variant="outline" onClick={onExit}>
          Exit demo
        </Button>
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
  const auth = useAuthUser();
  const profile = restaurant.profile ?? {};
  const [description, setDescription] = useState(profile.official_description ?? "");
  const [menuUrl, setMenuUrl] = useState(profile.menu_url ?? "");
  const [reservationUrl, setReservationUrl] = useState(profile.reservation_url ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.logo_url ?? "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url ?? "");
  const [lineUrl, setLineUrl] = useState(profile.line_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(profile.instagram_url ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [recipientId, setRecipientId] = useState("");
  const [kind, setKind] = useState<"message" | "voucher">("message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [terms, setTerms] = useState("");
  const [expiry, setExpiry] = useState("");
  const [uploading, setUploading] = useState("");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateBody, setUpdateBody] = useState("");
  const [updatePhotoUrl, setUpdatePhotoUrl] = useState("");
  const [updateCtaLabel, setUpdateCtaLabel] = useState("");
  const [updateCtaUrl, setUpdateCtaUrl] = useState("");
  const [updateExpiry, setUpdateExpiry] = useState("");
  const [demoSent, setDemoSent] = useState<any[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<
    "overview" | "profile" | "photos" | "updates" | "audience"
  >(demo ? "audience" : "overview");
  const workspaceTabs = [
    { value: "overview", Icon: Sparkles, label: copy("Overview", "ภาพรวม") },
    { value: "profile", Icon: Info, label: copy("Profile", "โปรไฟล์") },
    { value: "photos", Icon: Images, label: copy("Photos", "รูปภาพ") },
    { value: "updates", Icon: Newspaper, label: copy("Updates", "อัปเดต") },
    { value: "audience", Icon: Users, label: copy("Diners", "นักชิม") },
  ] as const;
  const audience = restaurant.audience ?? [];
  const gallery = restaurant.gallery ?? [];
  const updates = restaurant.updates ?? [];
  const growthActive =
    demo ||
    (profile.subscription_tier === "growth" &&
      (profile.subscription_status === "active" ||
        (profile.subscription_status === "trialing" &&
          profile.trial_ends_at &&
          new Date(profile.trial_ends_at).getTime() > Date.now())));
  const selectedDiner = audience.find((item: any) => item.user_id === recipientId);
  useEffect(() => {
    if (!selectedDiner) return;
    if (kind === "message" && !selectedDiner.allow_messages && selectedDiner.allow_vouchers) {
      setKind("voucher");
    } else if (
      kind === "voucher" &&
      !selectedDiner.allow_vouchers &&
      selectedDiner.allow_messages
    ) {
      setKind("message");
    }
  }, [kind, selectedDiner]);
  const save = useMutation({
    mutationFn: () =>
      updateRestaurantProfile({
        data: {
          placeId: restaurant.place_id,
          officialDescription: description,
          menuUrl,
          reservationUrl,
          logoUrl,
          coverUrl,
          lineUrl,
          instagramUrl,
          phone,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      toast.success(copy("Official profile saved", "บันทึกโปรไฟล์ทางการแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const trial = useMutation({
    mutationFn: () => startRestaurantGrowthTrial({ data: { placeId: restaurant.place_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      toast.success(copy("Your 14-day Growth trial is active", "เริ่มทดลอง Growth 14 วันแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const addGallery = useMutation({
    mutationFn: (photoUrl: string) =>
      addRestaurantGalleryPhoto({
        data: { placeId: restaurant.place_id, photoUrl },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restaurant-workspace"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const removeGallery = useMutation({
    mutationFn: (photoId: string) =>
      deleteRestaurantGalleryPhoto({
        data: { placeId: restaurant.place_id, photoId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restaurant-workspace"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const publishUpdate = useMutation({
    mutationFn: () =>
      createRestaurantUpdate({
        data: {
          placeId: restaurant.place_id,
          title: updateTitle,
          body: updateBody,
          photoUrl: updatePhotoUrl || undefined,
          ctaLabel: updateCtaLabel || undefined,
          ctaUrl: updateCtaUrl || undefined,
          expiresAt: updateExpiry ? new Date(updateExpiry).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      setUpdateTitle("");
      setUpdateBody("");
      setUpdatePhotoUrl("");
      setUpdateCtaLabel("");
      setUpdateCtaUrl("");
      setUpdateExpiry("");
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      toast.success(copy("Official update published", "เผยแพร่อัปเดตทางการแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeUpdate = useMutation({
    mutationFn: (updateId: string) =>
      deleteRestaurantUpdate({
        data: { placeId: restaurant.place_id, updateId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["restaurant-workspace"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadPhoto = async (file: File, purpose: "logo" | "cover" | "gallery" | "update") => {
    if (!auth.userId || demo) return;
    setUploading(purpose);
    try {
      validatePhotoFile(file);
      const path = buildPhotoPath(auth.userId, file).replace(
        `${auth.userId}/`,
        `${auth.userId}/restaurant/${restaurant.place_id}/`,
      );
      const { error } = await supabase.storage
        .from("dish-photos")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw new Error(error.message);
      const url = `/photos/${path}`;
      if (purpose === "logo") setLogoUrl(url);
      if (purpose === "cover") setCoverUrl(url);
      if (purpose === "update") setUpdatePhotoUrl(url);
      if (purpose === "gallery") await addGallery.mutateAsync(url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading("");
    }
  };
  const send = useMutation({
    mutationFn: () =>
      sendRestaurantOutreach({
        data: {
          placeId: restaurant.place_id,
          recipientUserId: recipientId,
          kind,
          subject,
          body,
          voucherTerms: kind === "voucher" ? terms : undefined,
          expiresAt: kind === "voucher" && expiry ? new Date(expiry).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-workspace"] });
      setSubject("");
      setBody("");
      setTerms("");
      setExpiry("");
      toast.success(copy("Sent to the consenting diner", "ส่งให้นักชิมที่อนุญาตแล้ว"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const handleSend = () => {
    if (!selectedDiner || !subject.trim() || !body.trim()) return;
    if (demo) {
      const item = {
        id: `demo-sent-${Date.now()}`,
        recipient:
          selectedDiner.diner?.display_name || selectedDiner.diner?.username || "Demo diner",
        kind,
        subject: subject.trim(),
        body: body.trim(),
        voucherCode: kind === "voucher" ? generateVoucherNumber() : null,
        voucherTerms: kind === "voucher" ? terms.trim() : null,
        expiresAt: kind === "voucher" ? expiry : null,
      };
      setDemoSent((current) => [item, ...current]);
      setSubject("");
      setBody("");
      setTerms("");
      setExpiry("");
      toast.success(
        copy(
          kind === "voucher" ? "Demo voucher delivered" : "Demo message delivered",
          kind === "voucher" ? "ส่งบัตรกำนัลตัวอย่างแล้ว" : "ส่งข้อความตัวอย่างแล้ว",
        ),
      );
      return;
    }
    send.mutate();
  };

  return (
    <div className="mt-7 space-y-7">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/40 bg-primary/5 p-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
            <ShieldCheck size={16} /> {copy("Verified restaurant", "ร้านที่ยืนยันแล้ว")}
          </p>
          <h2 className="mt-2 font-display text-3xl">{restaurant.place?.name}</h2>
        </div>
        {!demo ? (
          <Link to="/place/$placeId" params={{ placeId: restaurant.place_id }}>
            <Button variant="outline">{copy("View public profile", "ดูโปรไฟล์สาธารณะ")}</Button>
          </Link>
        ) : null}
      </section>

      <nav
        className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
        aria-label={copy("Restaurant workspace", "พื้นที่จัดการร้าน")}
      >
        {workspaceTabs.map(({ value, Icon, label }) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setWorkspaceTab(value)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition ${
              workspaceTab === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {workspaceTab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setWorkspaceTab("profile")}
            className="rounded-lg border border-border bg-card p-5 text-left transition hover:border-primary/60"
          >
            <Info className="text-primary" size={21} />
            <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">
              {copy("Public profile", "โปรไฟล์สาธารณะ")}
            </p>
            <p className="mt-1 font-display text-2xl uppercase">
              {copy("Edit restaurant details", "แก้ไขข้อมูลร้าน")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab("updates")}
            className="rounded-lg border border-border bg-card p-5 text-left transition hover:border-primary/60"
          >
            <Newspaper className="text-primary" size={21} />
            <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">
              {copy("Official updates", "อัปเดตทางการ")}
            </p>
            <p className="mt-1 font-display text-2xl uppercase">
              {updates.length} {copy("published", "รายการ")}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceTab("audience")}
            className="rounded-lg border border-border bg-card p-5 text-left transition hover:border-primary/60"
          >
            <Users className="text-primary" size={21} />
            <p className="mt-4 text-xs font-bold uppercase text-muted-foreground">
              {copy("Consenting diners", "นักชิมที่อนุญาต")}
            </p>
            <p className="mt-1 font-display text-2xl uppercase">
              {audience.length} {copy("available", "คน")}
            </p>
          </button>
        </div>
      ) : null}

      {workspaceTab === "overview" ? (
        <section
          className={`rounded-lg border p-5 ${growthActive ? "border-gold/50 bg-gold/10" : "border-border bg-card"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="editorial-kicker text-primary">
                {growthActive
                  ? copy("Growth active", "Growth เปิดใช้งาน")
                  : copy("Free verified profile", "โปรไฟล์ยืนยันฟรี")}
              </p>
              <h2 className="mt-2 font-display text-3xl uppercase">
                {growthActive
                  ? copy("Turn interest into repeat business", "เปลี่ยนความสนใจเป็นลูกค้าประจำ")
                  : copy(
                      "Unlock gallery, updates, messages and vouchers",
                      "ปลดล็อกแกลเลอรี อัปเดต ข้อความ และบัตรกำนัล",
                    )}
              </h2>
              {profile.subscription_status === "trialing" && profile.trial_ends_at ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {copy("Trial ends", "ทดลองถึง")}{" "}
                  {new Date(profile.trial_ends_at).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            {!growthActive && !profile.trial_started_at && !demo ? (
              <Button onClick={() => trial.mutate()} disabled={trial.isPending}>
                {copy("Start 14-day Growth trial", "เริ่มทดลอง Growth 14 วัน")}
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {workspaceTab === "profile" ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="type-section-title">{copy("Official information", "ข้อมูลทางการ")}</h2>
          <div className="mt-4 space-y-3">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder={copy("Official restaurant description", "คำอธิบายร้านอย่างเป็นทางการ")}
            />
            <Input
              value={reservationUrl}
              onChange={(e) => setReservationUrl(e.target.value)}
              placeholder={copy(
                "Reservation URL (SevenRooms, TableCheck, website…)",
                "ลิงก์จองโต๊ะ (SevenRooms, TableCheck, เว็บไซต์…)",
              )}
            />
            <Input
              value={menuUrl}
              onChange={(e) => setMenuUrl(e.target.value)}
              placeholder={copy("Official menu URL", "ลิงก์เมนูทางการ")}
            />
            <Input
              value={lineUrl}
              onChange={(e) => setLineUrl(e.target.value)}
              placeholder="LINE URL"
            />
            <Input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="Instagram URL"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={copy("Phone", "โทรศัพท์")}
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-sm hover:border-primary">
                <Camera className="mx-auto mb-2 h-5 w-5" />
                {uploading === "logo"
                  ? copy("Uploading…", "กำลังอัปโหลด…")
                  : copy("Upload logo", "อัปโหลดโลโก้")}
                <input
                  className="sr-only"
                  type="file"
                  accept={PHOTO_ACCEPT_ATTR}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file, "logo");
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="cursor-pointer rounded-md border border-dashed border-border p-3 text-center text-sm hover:border-primary">
                <Camera className="mx-auto mb-2 h-5 w-5" />
                {uploading === "cover"
                  ? copy("Uploading…", "กำลังอัปโหลด…")
                  : copy("Upload cover", "อัปโหลดภาพปก")}
                <input
                  className="sr-only"
                  type="file"
                  accept={PHOTO_ACCEPT_ATTR}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file, "cover");
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {logoUrl || coverUrl ? (
              <div className="grid grid-cols-2 gap-3">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  <div />
                )}
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : null}
              </div>
            ) : null}
            <Button onClick={() => save.mutate()} disabled={demo || save.isPending}>
              {copy("Save profile", "บันทึกโปรไฟล์")}
            </Button>
          </div>
        </section>
      ) : null}

      {workspaceTab === "audience" ? (
        <section
          className={`rounded-lg border border-border bg-card p-5 ${growthActive ? "" : "opacity-60"}`}
        >
          <h2 className="type-section-title">{copy("Consenting diners", "นักชิมที่อนุญาต")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy(
              "Only diners who marked one of your dishes and explicitly opted in appear here.",
              "แสดงเฉพาะนักชิมที่ทำเครื่องหมายจานของร้านและอนุญาตอย่างชัดเจน",
            )}
          </p>
          {!growthActive ? (
            <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm font-semibold">
              {copy(
                "Available with Growth. Start the trial to see consenting diners and contact them manually.",
                "ใช้ได้ในแพ็กเกจ Growth เริ่มทดลองเพื่อดูนักชิมที่อนุญาตและติดต่อด้วยตนเอง",
              )}
            </p>
          ) : (
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {audience.map((item: any) => {
                const name =
                  item.diner?.display_name ||
                  item.diner?.username ||
                  copy("Private diner", "นักชิมส่วนตัว");
                return (
                  <button
                    key={item.user_id}
                    type="button"
                    onClick={() => setRecipientId(item.user_id)}
                    className={`w-full rounded-md border p-3 text-left ${recipientId === item.user_id ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className="font-semibold">{name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.allow_messages ? copy("Messages", "ข้อความ") : ""}
                      {item.allow_messages && item.allow_vouchers ? " · " : ""}
                      {item.allow_vouchers ? copy("Vouchers", "บัตรกำนัล") : ""}
                    </p>
                  </button>
                );
              })}
              {!audience.length ? (
                <p className="text-sm text-muted-foreground">
                  {copy("No diners have opted in yet.", "ยังไม่มีนักชิมอนุญาต")}
                </p>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {workspaceTab === "photos" ? (
        <section
          className={`rounded-lg border border-border bg-card p-5 ${growthActive ? "" : "opacity-60"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="editorial-kicker text-primary">
                {copy("Growth gallery", "แกลเลอรี Growth")}
              </p>
              <h2 className="type-section-title mt-2">
                {copy("Show the restaurant experience", "แสดงประสบการณ์ในร้าน")}
              </h2>
            </div>
            <label
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 font-semibold ${growthActive && gallery.length < 12 && !demo ? "cursor-pointer hover:border-primary" : "pointer-events-none"}`}
            >
              <Camera size={17} />
              {uploading === "gallery"
                ? copy("Uploading…", "กำลังอัปโหลด…")
                : copy("Add gallery photo", "เพิ่มภาพแกลเลอรี")}
              <input
                className="sr-only"
                type="file"
                accept={PHOTO_ACCEPT_ATTR}
                disabled={!growthActive || demo}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPhoto(file, "gallery");
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {gallery.map((photo: any) => (
              <div key={photo.id} className="group relative">
                <img
                  src={photo.photo_url}
                  alt={photo.caption || ""}
                  className="aspect-square w-full rounded-md object-cover"
                />
                {!demo ? (
                  <button
                    type="button"
                    onClick={() => removeGallery.mutate(photo.id)}
                    className="absolute right-2 top-2 rounded-full bg-black/75 p-2 text-white"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {!growthActive ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {copy(
                "Start Growth to add up to 12 official photos.",
                "เริ่ม Growth เพื่อเพิ่มภาพทางการสูงสุด 12 ภาพ",
              )}
            </p>
          ) : null}
        </section>
      ) : null}

      {workspaceTab === "updates" ? (
        <section
          className={`rounded-lg border border-border bg-card p-5 ${growthActive ? "" : "opacity-60"}`}
        >
          <p className="editorial-kicker text-primary">
            {copy("Official updates", "อัปเดตทางการ")}
          </p>
          <h2 className="type-section-title mt-2">
            {copy("Give diners a reason to return", "สร้างเหตุผลให้นักชิมกลับมา")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy(
              "Publish up to two updates every 7 days. Updates are labeled as restaurant content and never affect rankings.",
              "เผยแพร่ได้สูงสุด 2 อัปเดตต่อ 7 วัน เนื้อหาจะแสดงว่าเป็นของร้านและไม่มีผลต่ออันดับ",
            )}
          </p>
          <div className="mt-5 grid gap-3">
            <Input
              value={updateTitle}
              onChange={(e) => setUpdateTitle(e.target.value)}
              maxLength={100}
              placeholder={copy("Update title", "หัวข้ออัปเดต")}
              disabled={!growthActive || demo}
            />
            <Textarea
              value={updateBody}
              onChange={(e) => setUpdateBody(e.target.value)}
              maxLength={1000}
              placeholder={copy("What should diners know?", "อยากบอกอะไรกับนักชิม?")}
              disabled={!growthActive || demo}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={updateCtaLabel}
                onChange={(e) => setUpdateCtaLabel(e.target.value)}
                maxLength={40}
                placeholder={copy("Button label (optional)", "ข้อความปุ่ม (ไม่บังคับ)")}
                disabled={!growthActive || demo}
              />
              <Input
                value={updateCtaUrl}
                onChange={(e) => setUpdateCtaUrl(e.target.value)}
                placeholder={copy("Button URL (optional)", "ลิงก์ปุ่ม (ไม่บังคับ)")}
                disabled={!growthActive || demo}
              />
              <Input
                value={updateExpiry}
                onChange={(e) => setUpdateExpiry(e.target.value)}
                type="datetime-local"
                disabled={!growthActive || demo}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <label
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 font-semibold ${growthActive && !demo ? "cursor-pointer" : "pointer-events-none"}`}
              >
                <Camera size={17} />{" "}
                {updatePhotoUrl
                  ? copy("Photo ready", "มีรูปแล้ว")
                  : copy("Add update photo", "เพิ่มรูปอัปเดต")}
                <input
                  className="sr-only"
                  type="file"
                  accept={PHOTO_ACCEPT_ATTR}
                  disabled={!growthActive || demo}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file, "update");
                    event.target.value = "";
                  }}
                />
              </label>
              <Button
                onClick={() => publishUpdate.mutate()}
                disabled={
                  !growthActive ||
                  demo ||
                  publishUpdate.isPending ||
                  !updateTitle.trim() ||
                  !updateBody.trim()
                }
              >
                {copy("Publish official update", "เผยแพร่อัปเดตทางการ")}
              </Button>
            </div>
          </div>
          {updates.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {updates.map((item: any) => (
                <article key={item.id} className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-primary">
                        {copy("Official restaurant update", "อัปเดตทางการจากร้าน")}
                      </p>
                      <h3 className="mt-1 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                    </div>
                    {!demo ? (
                      <button type="button" onClick={() => removeUpdate.mutate(item.id)}>
                        <Trash2 size={17} />
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {workspaceTab === "audience" && selectedDiner ? (
        <section className="rounded-lg border border-border bg-secondary/30 p-5">
          <h2 className="type-section-title">{copy("Send manually", "ส่งด้วยตนเอง")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {copy(
              "Messages are limited to one per 7 days; gift vouchers to one per 30 days for each diner.",
              "ข้อความจำกัด 1 ครั้งต่อ 7 วัน และบัตรกำนัล 1 ครั้งต่อ 30 วันต่อนักชิม",
            )}
          </p>
          <div className="mt-4 flex gap-2">
            {selectedDiner.allow_messages ? (
              <Button
                variant={kind === "message" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setKind("message")}
              >
                <MessageCircle size={16} /> {copy("Message", "ข้อความ")}
              </Button>
            ) : null}
            {selectedDiner.allow_vouchers ? (
              <Button
                variant={kind === "voucher" ? "default" : "outline"}
                className="gap-2"
                onClick={() => setKind("voucher")}
              >
                <Gift size={16} /> {copy("Gift voucher", "บัตรกำนัล")}
              </Button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={100}
              placeholder={copy("Subject", "หัวข้อ")}
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder={copy("Write a respectful message", "เขียนข้อความอย่างสุภาพ")}
            />
            {kind === "voucher" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  type="datetime-local"
                />
                <Input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder={copy("Terms", "เงื่อนไข")}
                />
                <p className="text-xs text-muted-foreground md:col-span-2">
                  {copy(
                    "JaanNee generates a unique security number automatically. The offer text appears inside the voucher message.",
                    "JaanNee จะสร้างหมายเลขความปลอดภัยที่ไม่ซ้ำโดยอัตโนมัติ ข้อความข้อเสนอจะแสดงอยู่ในบัตรกำนัล",
                  )}
                </p>
              </div>
            ) : null}
            {kind === "voucher" && subject.trim() && body.trim() ? (
              <VoucherCard
                restaurantName={restaurant.place?.name || copy("Restaurant", "ร้านอาหาร")}
                title={subject.trim()}
                message={body.trim()}
                securityNumber={copy("Generated when sent", "สร้างเมื่อส่ง")}
                terms={terms.trim() || null}
                expiresAt={
                  expiry && !Number.isNaN(new Date(expiry).getTime())
                    ? new Date(expiry).toISOString()
                    : null
                }
                language={lang}
              />
            ) : null}
            <Button
              className="w-fit"
              disabled={
                !subject.trim() || !body.trim() || (kind === "voucher" && !expiry) || send.isPending
              }
              onClick={handleSend}
            >
              {demo ? copy("Send demo", "ส่งตัวอย่าง") : copy("Send", "ส่ง")}
            </Button>
          </div>
          {demoSent.length ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                {copy("Demo delivery history", "ประวัติการส่งตัวอย่าง")}
              </p>
              <div className="mt-3 space-y-3">
                {demoSent.map((item) => (
                  <article key={item.id} className="rounded-md border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{item.subject}</p>
                      <span className="text-xs font-bold uppercase text-primary">
                        {item.kind === "voucher"
                          ? copy("Gift voucher", "บัตรกำนัล")
                          : copy("Message", "ข้อความ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {copy("Delivered to", "ส่งถึง")} {item.recipient}
                    </p>
                    {item.voucherCode ? (
                      <VoucherCard
                        restaurantName={restaurant.place?.name || copy("Restaurant", "ร้านอาหาร")}
                        title={item.subject}
                        message={item.body}
                        securityNumber={item.voucherCode}
                        terms={item.voucherTerms}
                        expiresAt={item.expiresAt}
                        language={lang}
                      />
                    ) : (
                      <p className="mt-3 text-sm">{item.body}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

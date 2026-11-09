import { createFileRoute,Link } from "@tanstack/react-router";
import { useQuery,useMutation,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check,Clipboard,Gift,Heart,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getMyRestaurantLoyaltyCard,joinRestaurantLoyalty,getMyLoyaltyCheckinCode } from "@/lib/restaurant-loyalty.functions";
import { useAuthUser } from "@/lib/use-auth";

export const Route=createFileRoute("/_authenticated/loyalty/$businessId")({
  head:()=>({meta:[{title:"My restaurant loyalty · JaanNee"},{name:"robots",content:"noindex,nofollow"}]}),
  component:DinerLoyalty,
});

function DinerLoyalty(){
  const {businessId}=Route.useParams();
  const {userId}=useAuthUser();
  const qc=useQueryClient();
  const [proof,setProof]=useState<{token:string;action:string;expiresInSeconds:number}|null>(null);
  const q=useQuery({
    queryKey:["my-restaurant-loyalty",businessId,userId],
    queryFn:()=>getMyRestaurantLoyaltyCard({data:{businessId}}),
    enabled:Boolean(userId),retry:false,
  });
  const enroll=useMutation({
    mutationFn:()=>joinRestaurantLoyalty({data:{businessId}}),
    onSuccess:async()=>{
      await qc.invalidateQueries({queryKey:["my-restaurant-loyalty",businessId]});
      toast.success("Joined the loyalty program");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  const code=useMutation({
    mutationFn:()=>getMyLoyaltyCheckinCode({data:{businessId}}),
    onSuccess:(result)=>{
      setProof(result);
      toast.message("Show the code to restaurant staff within five minutes");
    },
    onError:(error:Error)=>toast.error(error.message),
  });
  const p=q.data;
  return <AppShell tone="noir">
    <main className="mx-auto max-w-3xl space-y-6 pb-16">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Restaurant rewards</p>
        <h1 className="mt-2 font-display text-4xl">My loyalty card</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Stamps require an in-person staff confirmation; no self-awarding.
          Joining a loyalty program does not subscribe you to marketing messages.
        </p>
      </header>
      {q.isLoading?<p className="text-sm text-muted-foreground">Loading loyalty details…</p>:null}
      {q.isError?<p role="alert" className="border border-border p-4 text-sm text-muted-foreground">Loyalty is unavailable while the database is restricted.</p>:null}
      {!p&&!q.isLoading?<p className="border border-border p-5 text-sm">
        This restaurant does not currently have a live loyalty program.
      </p>:null}
      {p?<div className="space-y-5 border border-border p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{p.restaurant}</p>
        <h2 className="font-display text-3xl">{p.title}</h2>
        <p className="text-sm text-muted-foreground">{p.reward_description}</p>
        {p.card?<div className="space-y-5">
          <div className="flex flex-wrap gap-2" aria-label="Loyalty visit progress">
            {Array.from({length:p.visits_required},(_,i)=><span key={i}
              className={"flex h-11 w-11 items-center justify-center rounded-full border " +
                (i<p.card.visits?"border-primary bg-primary text-white":"border-border text-muted-foreground")}>
              {i<p.card.visits?<Check size={17}/>:i+1}
            </span>)}
          </div>
          <p className="font-semibold">{p.card.reward_ready?
            "Your reward is ready. Ask staff to redeem it.":
            p.card.visits+" of "+p.visits_required+" visits recorded"}</p>
          <Button disabled={code.isPending} onClick={()=>code.mutate()}>
            <ShieldCheck size={16} className="mr-2"/> Show one-time guest check-in code
          </Button>
          {proof?<div className="border-l-2 border-primary p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {proof.action==="visit"?"Guest visit code":"Reward redemption code"}
            </p>
            <p className="mt-3 break-all font-mono text-xs leading-5">{proof.token}</p>
            <p className="mt-3 text-xs text-muted-foreground">Expires after 5 minutes. Show this to the restaurant staff; it cannot be used by another restaurant.</p>
            <Button variant="outline" className="mt-3" onClick={()=>void navigator.clipboard.writeText(proof.token)
              .then(()=>toast.success("Guest code copied"))
              .catch(()=>toast.error("Clipboard unavailable"))}>
              <Clipboard size={16} className="mr-2"/> Copy code
            </Button>
          </div>:null}
        </div>:<Button disabled={enroll.isPending} onClick={()=>enroll.mutate()}>
          <Heart size={16} className="mr-2"/> Join this loyalty program
        </Button>}
      </div>:null}
      <Link to="/offers" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">
        <Gift size={16}/> My voucher offers
      </Link>
    </main>
  </AppShell>;
}

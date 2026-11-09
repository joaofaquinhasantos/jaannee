import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileImage, FileText, Globe2, Languages, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getRestaurantAiStatus,
  previewBusinessTranslations,
  previewImportedBusinessMenu,
} from "@/lib/restaurant-ai.functions";

export type ImportedReviewItem = {
  category: string;
  name: string;
  description: string;
  priceThb: number;
  needsPriceReview: boolean;
};
type TranslationLanguage = "th" | "zh" | "ja" | "fr";
export type ApprovedMenuTranslation = {
  name: string;
  description: string;
};

export function BusinessAiImport({ businessId, onReview }: {
  businessId: string;
  onReview: (item: ImportedReviewItem) => void;
}) {
  const [sourceText, setSourceText] = useState("");
  const [image, setImage] = useState<{mime:"image/jpeg"|"image/png"|"image/webp";base64:string}|null>(null);
  const [extracted, setExtracted] = useState<ImportedReviewItem[]>([]);
  const [fileName, setFileName] = useState("");
  const status = useQuery({
    queryKey: ["business-ai-status",businessId],
    queryFn:()=>getRestaurantAiStatus({data:{businessId}}),
    enabled:Boolean(businessId),
    retry:false,
  });
  const enabled=status.data?.available===true && (status.data.monthlyRemaining??0)>0;

  useEffect(() => {
    setExtracted([]);
    setImage(null);
    setSourceText("");
    setFileName("");
  }, [businessId]);

  const run = useMutation({
    mutationFn:()=>previewImportedBusinessMenu({data:{
      businessId,
      source:image
        ? {type:"image" as const,mime:image.mime,base64:image.base64}
        : {type:"text" as const,text:sourceText},
    }}),
    onSuccess:(result)=>{
      setExtracted(result.items);
      toast.success("Review extracted dishes and prices before saving");
      void status.refetch();
    },
    onError:(error:Error)=>{toast.error(error.message);void status.refetch();},
  });
  const selectFile=async(file:File|undefined)=>{
    setImage(null);setFileName("");
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){
      toast.error("Select JPEG, PNG or WebP. PDF import is not supported yet.");
      return;
    }
    if(file.size>1_000_000){
      toast.error("Please compress the menu photo to under 1 MB.");
      return;
    }
    try{
      const base64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result??"").split(",")[1]??"");
        reader.onerror=()=>reject(new Error("Unable to read image"));
        reader.readAsDataURL(file);
      });
      setImage({mime:file.type as "image/jpeg"|"image/png"|"image/webp",base64});
      setFileName(file.name);
      setSourceText("");
    }catch{toast.error("Could not read that menu image.");}
  };

  return <section className="space-y-4 border border-border p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <Sparkles className="mt-1 shrink-0 text-primary" size={21}/>
      <div>
        <h2 className="font-display text-3xl">AI menu import</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Paste menu text or choose one compressed menu photo. Extraction creates a temporary
          review list; nothing is automatically saved or published.
        </p>
      </div>
    </div>

    {status.isLoading ? <p className="text-sm text-muted-foreground">Checking your plan…</p> : null}
    {status.isError ? <p role="status" className="text-sm text-muted-foreground">
      AI availability cannot be verified while the database is unavailable.
    </p> : status.data ? <div className="border-l-2 border-primary bg-secondary/30 p-3 text-xs leading-6">
      {status.data.available ? <p>Pro AI access configured · {status.data.monthlyRemaining} of 20 monthly requests remaining.</p> :
        <p>
          {status.data.ownerVerified ? "" : "Restaurant verification is required. "}
          {status.data.planEligible ? "" : "An active Pro or Growth plan is required. "}
          {status.data.providerConfigured ? "" : "AI provider is not enabled on this deployment."}
        </p>}
    </div> : null}

    <label className="block space-y-2">
      <span className="text-sm font-semibold">Menu text</span>
      <Textarea rows={6} maxLength={7000} value={sourceText} disabled={!enabled || run.isPending}
        onChange={(event)=>{setSourceText(event.target.value);setImage(null);setFileName("");}}
        placeholder="Paste menu names, descriptions and printed prices…"/>
      <span className="block text-xs text-muted-foreground">{sourceText.length}/7000 characters</span>
    </label>
    <div className="flex flex-wrap items-center gap-3">
      <label className={"inline-flex min-h-11 cursor-pointer items-center gap-2 border border-border px-4 text-sm " +
        (!enabled ? "pointer-events-none opacity-50":"")}>
        <FileImage size={17}/> {fileName ? "Replace menu photo" : "Choose menu photo"}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          disabled={!enabled || run.isPending} onChange={(event)=>{void selectFile(event.target.files?.[0]);}}/>
      </label>
      {fileName ? <span className="break-all text-xs text-muted-foreground">{fileName} · temporary</span> : null}
      <Button disabled={!enabled || run.isPending || (!image && sourceText.trim().length<30)}
        onClick={()=>run.mutate()}>
        <FileText size={16} className="mr-2"/>{run.isPending?"Processing…":"Extract for review"}
      </Button>
    </div>
    <p className="text-xs leading-6 text-muted-foreground">
      JPEG, PNG or WebP under 1 MB. Uploaded images are sent to the configured AI provider
      for processing but are not stored by this feature. Generated text may be inaccurate.
    </p>
    {extracted.length ? <div className="space-y-3 border-t border-border pt-5">
      <h3 className="font-display text-2xl">Review {extracted.length} suggestions</h3>
      <p className="text-xs leading-6 text-muted-foreground">
        Verify every price, ingredient and description in the menu editor.
        Suggestions marked Missing price cannot be published without correction.
      </p>
      {extracted.map((item,i)=><article key={i} className="flex flex-wrap items-center gap-3 border border-border p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{item.category}</p>
          <p className="mt-1 text-sm font-semibold">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
          <p className="mt-2 text-xs">{item.needsPriceReview ? "Missing price · Requires review" : "฿"+item.priceThb}</p>
        </div>
        <Button variant="outline" onClick={()=>onReview(item)}>Review in editor</Button>
      </article>)}
    </div> : null}
  </section>;
}

export function BusinessAiTranslate({ businessId, original, onApproveDraft }: {
  businessId:string;
  original:{name:string;description:string};
  onApproveDraft:(language:TranslationLanguage,draft:ApprovedMenuTranslation)=>void;
}) {
  const [language,setLanguage]=useState<TranslationLanguage>("th");
  const [draft,setDraft]=useState<ApprovedMenuTranslation|null>(null);
  const [complete,setComplete]=useState(false);
  const status=useQuery({
    queryKey:["business-ai-status",businessId],
    queryFn:()=>getRestaurantAiStatus({data:{businessId}}),
    enabled:Boolean(businessId),
    retry:false,
  });
  const translate=useMutation({
    mutationFn:()=>previewBusinessTranslations({data:{
      businessId,targetLanguage:language,
      items:[{name:original.name,description:original.description}],
    }}),
    onSuccess:(data)=>{
      const value=data.translations[0];
      setDraft({name:value.name,description:value.description});
      setComplete(false);
      void status.refetch();
    },
    onError:(error:Error)=>{toast.error(error.message);void status.refetch();},
  });
  const eligible=status.data?.available===true && (status.data.monthlyRemaining??0)>0;
  const names:Record<TranslationLanguage,string>={th:"Thai",zh:"Simplified Chinese",ja:"Japanese",fr:"French"};
  return <div className="space-y-3 border-t border-border pt-5">
    <h4 className="flex items-center gap-2 font-semibold"><Languages size={18}/> AI draft translation</h4>
    <p className="text-xs leading-6 text-muted-foreground">
      Translations are not saved automatically. Read, correct and explicitly approve before saving the dish.
    </p>
    <div className="flex flex-wrap gap-2">
      <label className="min-h-11 text-xs">
        <span className="mr-2">Language</span>
        <select value={language} onChange={(event)=>{setLanguage(event.target.value as TranslationLanguage);setDraft(null);setComplete(false);}}
          className="min-h-11 border border-border bg-background px-2">
          {(["th","zh","ja","fr"] as const).map((lang)=><option key={lang} value={lang}>{names[lang]}</option>)}
        </select>
      </label>
      <Button variant="outline" disabled={!eligible || translate.isPending || original.name.trim().length===0}
        onClick={()=>translate.mutate()}>
        <Globe2 size={16} className="mr-2"/>{translate.isPending?"Translating…":"Generate preview"}
      </Button>
    </div>
    {draft ? <div className="space-y-3 border border-border p-4">
      <label className="block space-y-1"><span className="text-sm font-semibold">Review name</span>
        <Input value={draft.name} maxLength={120} onChange={(event)=>{setDraft({...draft,name:event.target.value});setComplete(false);}}/>
      </label>
      <label className="block space-y-1"><span className="text-sm font-semibold">Review description</span>
        <Textarea rows={2} value={draft.description} maxLength={500}
          onChange={(event)=>{setDraft({...draft,description:event.target.value});setComplete(false);}}/>
      </label>
      <label className="flex items-start gap-2 text-xs leading-6">
        <input type="checkbox" checked={complete} onChange={(event)=>setComplete(event.target.checked)}
          className="mt-1 h-4 w-4"/>
        I reviewed this translation against the original and approve it for the menu.
      </label>
      <Button disabled={!complete || !draft.name.trim()}
        onClick={()=>{
          onApproveDraft(language,draft);
          setDraft(null);setComplete(false);
          toast.success("Approved draft added to the editor. Save the dish to publish changes.");
        }}>
        <ShieldAlert size={16} className="mr-2"/> Use approved translation in editor
      </Button>
    </div> : null}
  </div>;
}

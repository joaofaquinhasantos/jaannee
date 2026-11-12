import { Copy, ExternalLink, Printer, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import "./BusinessQrStudio.css";

export function BusinessQrStudio({name,url,slug}:{name:string;url:string;slug:string}) {
  const qrSrc="https://quickchart.io/qr?size=600&margin=4&text="+encodeURIComponent(url);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(url);toast.success("Permanent menu URL copied");}
    catch{toast.error("Clipboard unavailable. Copy the visible URL instead.");}
  };
  const print=()=>{
    document.body.classList.add("jaannee-print-qr");
    const reset=()=>document.body.classList.remove("jaannee-print-qr");
    window.addEventListener("afterprint",reset,{once:true});
    window.print();
    // Some embedded webviews omit afterprint. Always restore the page.
    window.setTimeout(reset,1500);
  };
  return <div className="stitch-qr-studio">
    <div className="stitch-qr-preview-wrap">
      <div id="stitch-qr-print-card" className="stitch-qr-print-card">
        <span className="stitch-qr-brand">จ Jaannee</span>
        <p className="stitch-qr-intro">Scan to explore our menu</p>
        <h3>{name}</h3>
        <img src={qrSrc} width={230} height={230}
          alt={"QR code for the published menu of "+name}
          loading="lazy" referrerPolicy="no-referrer"/>
        <p>Read-only menu · Language selection</p>
        <span className="stitch-qr-print-url">{url}</span>
      </div>
    </div>
    <div className="stitch-qr-steps">
      <p className="stitch-feed-eyebrow">Permanent QR menu</p>
      <h3>One link. Always up to date.</h3>
      <p>Print your restaurant's QR code once. The address remains the same when you edit or translate published dishes.</p>
      <div className="stitch-qr-url" title={url}>
        <QrCode size={20}/><span>{url}</span>
      </div>
      <div className="stitch-qr-action-row">
        <Button variant="outline" onClick={()=>void copy()}>
          <Copy size={17} className="mr-2"/> Copy menu URL
        </Button>
        <Button variant="outline" onClick={print}>
          <Printer size={17} className="mr-2"/> Print QR card
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-semibold">
          <ExternalLink size={17}/> Preview guest menu
        </a>
      </div>
      <p className="stitch-qr-note">
        <ShieldCheck size={17}/>
        The QR links only to a published, read-only menu. It does not take orders, request waiters, or process restaurant bills.
      </p>
      <p className="stitch-qr-thirdparty">
        Current QR image rendering uses QuickChart and sends it the already-public menu URL.
        Production should replace this with first-party QR generation before broad rollout.
      </p>
      <p className="stitch-qr-slug">Menu identifier: {slug}</p>
    </div>
  </div>;
}

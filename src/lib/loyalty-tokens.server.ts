// SERVER ONLY — short-lived guest proof for staff-authorized loyalty actions.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uuid=z.string().uuid();
const tokenPayload=z.object({
  businessId:uuid,
  programId:uuid,
  userId:uuid,
  action:z.enum(["visit","redeem"]),
  expires:z.number().int().positive(),
  nonce:z.string().regex(/^[a-f0-9]{24}$/),
});
export type LoyaltyAction="visit"|"redeem";

export function loyaltySecret():string{
  const secret=process.env.LOYALTY_CHECKIN_SECRET;
  if(!secret || secret.length<32 || process.env.ENABLE_RESTAURANT_LOYALTY!=="true"){
    throw new Error("Restaurant loyalty check-in is not enabled.");
  }
  return secret;
}

export function signLoyaltyToken(
  input:{businessId:string;programId:string;userId:string;action:LoyaltyAction},
  secret:string,now=Date.now(),
):string{
  if(secret.length<32)throw new Error("Loyalty token requires a long secret");
  const p=tokenPayload.parse({
    ...input,expires:Math.floor(now/1000)+300,nonce:randomBytes(12).toString("hex"),
  });
  const body=Buffer.from(JSON.stringify(p),"utf8").toString("base64url");
  const sig=createHmac("sha256",secret).update(body).digest("base64url");
  return body+"."+sig;
}

export function verifyLoyaltyToken(
  token:string,secret:string,now=Date.now(),
):z.infer<typeof tokenPayload>{
  if(!token || token.length>800 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)){
    throw new Error("Invalid guest check-in code.");
  }
  const [body,sig]=token.split(".");
  const expected=createHmac("sha256",secret).update(body).digest();
  const got=Buffer.from(sig,"base64url");
  if(got.length!==expected.length || !timingSafeEqual(expected,got)){
    throw new Error("Invalid guest check-in signature.");
  }
  const data=tokenPayload.parse(JSON.parse(Buffer.from(body,"base64url").toString("utf8")));
  const time=Math.floor(now/1000);
  if(data.expires<=time || data.expires>time+300){
    throw new Error("Guest check-in code expired.");
  }
  return data;
}

export function generateVoucherNumber(randomId: string = crypto.randomUUID()) {
  const compact = randomId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (compact.length < 12) throw new Error("A secure random identifier is required.");
  return `JN-${compact.slice(0, 4)}-${compact.slice(4, 8)}-${compact.slice(8, 12)}`;
}

/**
 * Normalize Indian phone input to up to 10 digits (no +91/0 prefix in value).
 * Used by Auth/CustomerLogin for consistent signup/sign-in.
 */
export function normalizePhoneDigits(value: string): string {
  let v = value.replace(/\D/g, "");
  while (v.startsWith("91")) v = v.slice(2);
  if (v.startsWith("0")) v = v.slice(1);
  return v.slice(0, 10);
}

/** Format as E.164 for Supabase: +91 + 10 digits. */
export function toE164Indian(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  return d.length === 10 ? `+91${d}` : "";
}

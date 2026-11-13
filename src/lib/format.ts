export const money = (n: number | string) =>
  "Rs. " +
  Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ageFrom(dob: string, now = new Date()) {
  const d = new Date(dob);
  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  return years >= 2 ? `${years} yrs` : `${years * 12 + months} mo`;
}

export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export const dateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });

/** QR payload printed on cards: "ACV:<token>". Scanner/camera input accepts either form. */
export const QR_PREFIX = "ACV:";
export const qrPayload = (token: string) => `${QR_PREFIX}${token}`;
export const parseQr = (raw: string) => raw.trim().replace(/^ACV:/i, "").toLowerCase();

/** Sri Lankan mobile normaliser: 0771234567 / +94771234567 / 94771234567 → 0771234567 */
export function normaliseMobile(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("94") && digits.length === 11) return "0" + digits.slice(2);
  if (digits.length === 9) return "0" + digits;
  return digits;
}

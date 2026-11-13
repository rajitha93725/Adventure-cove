import QRCode from "qrcode";
import { qrPayload } from "@/lib/format";

/** Credit-card sized (85.6 × 54 mm) printable child QR card. Server component. */
export default async function QrCard({
  token,
  firstName,
  lastName,
  venueName,
  tagline,
}: {
  token: string;
  firstName: string;
  lastName: string;
  venueName: string;
  tagline: string;
}) {
  const svg = await QRCode.toString(qrPayload(token), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return (
    <div
      className="flex overflow-hidden rounded-[3mm] border border-line bg-white text-ink shadow-sm print:shadow-none"
      style={{ width: "85.6mm", height: "54mm" }}
    >
      <div className="flex flex-1 flex-col justify-between bg-brand p-[4mm] text-white">
        <div>
          <div className="text-[5mm] leading-none font-extrabold">{venueName}</div>
          <div className="text-[2.6mm] opacity-90">{tagline}</div>
        </div>
        <div>
          <div className="text-[2.4mm] uppercase opacity-80">Adventurer</div>
          <div className="text-[5mm] leading-tight font-extrabold">{firstName}</div>
          <div className="text-[3mm]">{lastName}</div>
        </div>
      </div>
      <div className="flex w-[34mm] items-center justify-center p-[3mm]">
        <div className="w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}

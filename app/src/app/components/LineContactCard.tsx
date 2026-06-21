import QRCode from "qrcode";
import { MessageCircle } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";

interface LineContactCardProps {
  addUrl: string | null;
  displayId: string | null;
  email?: string | null;
}

async function renderQrSvg(url: string): Promise<string | null> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      width: 160,
    });
  } catch {
    return null;
  }
}

export async function LineContactCard({
  addUrl,
  displayId,
  email = null,
}: LineContactCardProps) {
  if (!addUrl && !displayId && !email) return null;

  const qrSvg = addUrl ? await renderQrSvg(addUrl) : null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-primary" />
          <h2 className="text-lg font-bold text-text-dark">団体連絡先</h2>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {addUrl && (
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-xs text-green-700">
                LINEで友だち追加して連絡できます
              </p>
              <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <a
                  href={addUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-line-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-line-green-dark"
                >
                  <MessageCircle className="size-4" />
                  友だち追加
                </a>
                {qrSvg && (
                  <div
                    className="size-[160px] shrink-0 rounded-lg bg-white p-1"
                    aria-label="LINE友だち追加用QRコード"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-green-700">
                スマホはボタン、PCは手元のスマホでQRを読み取ってください。
              </p>
            </div>
          )}

          {displayId && (
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-green-700">LINE ID</p>
              <p className="mt-1 font-medium text-green-800">{displayId}</p>
            </div>
          )}

          {email && (
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-green-700">メール</p>
              <p className="mt-1 font-medium text-green-800">{email}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

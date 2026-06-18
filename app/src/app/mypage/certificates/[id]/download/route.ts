import { NextResponse } from "next/server";
import { fetchIssuedCertificateForPdf } from "@/lib/certificates/actions";
import { generateCertificatePdf } from "@/lib/certificates/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { certificate, error } = await fetchIssuedCertificateForPdf(id);

  if (!certificate) {
    const status =
      error === "ログインが必要です"
        ? 401
        : error === "この操作を行う権限がありません"
          ? 403
          : 404;
    return NextResponse.json(
      { error: error ?? "証明書が見つかりません" },
      { status }
    );
  }

  const bytes = await generateCertificatePdf(certificate);
  const filename = `${certificate.certificateNumber}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

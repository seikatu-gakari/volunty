import { readFile } from "node:fs/promises";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import type { CertificatePdfData } from "./types";

const FONT_PATH = join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.otf");

function drawCenteredText({
  pageWidth,
  font,
  text,
  size,
  y,
  drawText,
}: {
  pageWidth: number;
  font: PDFFont;
  text: string;
  size: number;
  y: number;
  drawText: (text: string, x: number, y: number, size: number) => void;
}) {
  const textWidth = font.widthOfTextAtSize(text, size);
  drawText(text, (pageWidth - textWidth) / 2, y, size);
}

export async function generateCertificatePdf(
  data: CertificatePdfData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await readFile(FONT_PATH);
  const font = await pdfDoc.embedFont(fontBytes);
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rgb(0.77, 0.28, 0),
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 52,
    y: 52,
    width: width - 104,
    height: height - 104,
    borderColor: rgb(0.98, 0.36, 0.01),
    borderWidth: 0.8,
  });

  const drawText = (text: string, x: number, y: number, size: number) => {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0.43, 0.15, 0),
    });
  };

  drawCenteredText({
    pageWidth: width,
    font,
    text: "参加証明書",
    size: 32,
    y: height - 130,
    drawText,
  });
  drawCenteredText({
    pageWidth: width,
    font,
    text: "Participation Certificate",
    size: 13,
    y: height - 156,
    drawText,
  });

  drawText(`証明書番号: ${data.certificateNumber}`, 92, height - 205, 11);
  drawText("下記の方は、Voluntyを通じて以下のボランティア活動に参加したことを証明します。", 92, height - 245, 14);

  const rows = [
    ["参加者名", data.participantName],
    ["活動名", data.opportunityTitle],
    ["団体名", data.organizationName],
    ["活動日", data.activityDateLabel],
    ["発行日", data.issuedAtLabel],
  ] as const;

  let currentY = height - 295;
  for (const [label, value] of rows) {
    drawText(label, 142, currentY, 13);
    drawText(value, 260, currentY, 15);
    page.drawLine({
      start: { x: 250, y: currentY - 8 },
      end: { x: width - 142, y: currentY - 8 },
      thickness: 0.6,
      color: rgb(0.77, 0.28, 0),
    });
    currentY -= 42;
  }

  drawCenteredText({
    pageWidth: width,
    font,
    text: "Volunty",
    size: 18,
    y: 92,
    drawText,
  });

  return pdfDoc.save();
}

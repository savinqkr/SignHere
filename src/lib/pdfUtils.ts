import { PDFDocument } from "pdf-lib";
import { SignPosition } from "@/types/contract";

/**
 * Embeds a base64 signature image into the PDF at the specified position.
 * pdf-lib uses a coordinate system with origin at bottom-left,
 * while the browser uses top-left. We convert accordingly.
 */
export async function embedSignatureIntoPdf(
  pdfBytes: ArrayBuffer,
  signatureBase64: string,
  signPosition: SignPosition,
  pdfRenderWidth: number,
  pdfRenderHeight: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const targetPage = pages[signPosition.page - 1] ?? pages[0];

  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  // Strip data URL prefix
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) =>
    c.charCodeAt(0)
  );

  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // Scale from rendered browser coordinates to actual PDF coordinates
  const scaleX = pageWidth / pdfRenderWidth;
  const scaleY = pageHeight / pdfRenderHeight;

  const pdfX = signPosition.x * scaleX;
  const pdfWidth = signPosition.width * scaleX;
  const pdfHeight = signPosition.height * scaleY;
  // pdf-lib y=0 is bottom; browser y increases downward
  const pdfY = pageHeight - signPosition.y * scaleY - pdfHeight;

  targetPage.drawImage(signatureImage, {
    x: pdfX,
    y: pdfY,
    width: pdfWidth,
    height: pdfHeight,
  });

  return pdfDoc.save();
}

/**
 * Converts a DOCX ArrayBuffer to a PDF ArrayBuffer via mammoth HTML + browser print.
 * Returns the HTML string for rendering inside an iframe for signing.
 */
export async function docxToHtml(docxBuffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml({ arrayBuffer: docxBuffer });
  return result.value;
}

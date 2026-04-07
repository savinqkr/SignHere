import { PDFDocument } from "pdf-lib";
import { SignPosition } from "@/types/contract";

/**
 * Embeds a base64 signature image into the PDF at the specified position.
 *
 * signPosition.x/y/width/height are in the coordinate space of the displayed
 * image at the time the admin dragged the sign box (stored as renderWidth ×
 * renderHeight pixels).  We scale those into PDF user-space units.
 *
 * pdf-lib's coordinate origin is bottom-left; the browser's is top-left, so
 * we flip the Y axis.
 */
export async function embedSignatureIntoPdf(
  pdfBytes: ArrayBuffer,
  signatureBase64: string,
  signPosition: SignPosition
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const targetPage = pages[Math.max(0, signPosition.page - 1)] ?? pages[0];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  // Strip data-URL prefix and decode to bytes
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, "");
  const signatureBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  // Scale: displayed render pixels → PDF user-space units
  const scaleX = pageWidth  / signPosition.renderWidth;
  const scaleY = pageHeight / signPosition.renderHeight;

  const pdfX      = signPosition.x      * scaleX;
  const pdfWidth  = signPosition.width  * scaleX;
  const pdfHeight = signPosition.height * scaleY;
  // Flip Y: pdf-lib y=0 is at the bottom of the page
  const pdfY = pageHeight - signPosition.y * scaleY - pdfHeight;

  targetPage.drawImage(signatureImage, {
    x: pdfX,
    y: pdfY,
    width: pdfWidth,
    height: pdfHeight,
  });

  return pdfDoc.save();
}

/** Converts a DOCX ArrayBuffer to HTML via mammoth (for preview only). */
export async function docxToHtml(docxBuffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml({ arrayBuffer: docxBuffer });
  return result.value;
}

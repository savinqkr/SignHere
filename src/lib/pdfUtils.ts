import { PDFDocument } from "pdf-lib";
import { SignPosition } from "@/types/contract";

/**
 * Embeds multiple signature images into the PDF at their respective positions.
 * signPositions and signatureBase64s are index-aligned arrays.
 *
 * Coordinate mapping:
 *  - x/y/width/height are in the displayed image's pixel space at drag time
 *  - renderWidth/renderHeight are the displayed image dimensions at that time
 *  - pdf-lib uses bottom-left origin, so we flip the Y axis
 */
export async function embedSignaturesIntoPdf(
  pdfBytes: ArrayBuffer,
  signatureBase64s: string[],
  signPositions: SignPosition[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < signPositions.length; i++) {
    const sp = signPositions[i];
    const sig = signatureBase64s[i];
    if (!sig) continue;

    const targetPage = pages[Math.max(0, sp.page - 1)] ?? pages[0];
    const { width: pageWidth, height: pageHeight } = targetPage.getSize();

    const base64Data = sig.replace(/^data:image\/\w+;base64,/, "");
    const sigBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const sigImage = await pdfDoc.embedPng(sigBytes);

    const scaleX = pageWidth  / sp.renderWidth;
    const scaleY = pageHeight / sp.renderHeight;

    targetPage.drawImage(sigImage, {
      x:      sp.x      * scaleX,
      y:      pageHeight - sp.y * scaleY - sp.height * scaleY,
      width:  sp.width  * scaleX,
      height: sp.height * scaleY,
    });
  }

  return pdfDoc.save();
}

/** Converts a DOCX ArrayBuffer to HTML via mammoth (for preview only). */
export async function docxToHtml(docxBuffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml({ arrayBuffer: docxBuffer });
  return result.value;
}

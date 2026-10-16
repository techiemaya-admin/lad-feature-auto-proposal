import type { Document } from "docxmlater";
import JSZip from "jszip";

/**
 * docxmlater 12.1 writes streamed ZIP entries, including a stored Content_Types
 * entry with deferred sizes. LibreOffice rejects that archive although AnyDoc
 * can read it. Materialize ZIP headers without altering any document parts.
 */
export async function wordDocumentBuffer(document: Document): Promise<Buffer> {
  const archive = await JSZip.loadAsync(await document.toBuffer());
  return archive.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: false,
  });
}

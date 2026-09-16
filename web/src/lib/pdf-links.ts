const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;
const YOUTUBE_HOST = /youtube\.com|youtu\.be/i;

function clean(rawUrl: string): string {
  return rawUrl.replace(/[.,;:!?)\]}]+$/, "");
}

/**
 * A PDF's visible text is often split across compressed content streams, so `file.text()` on the
 * raw bytes never finds a URL. Pull actual page text via pdf.js, plus link annotations — a "click
 * here" hyperlink has no URL in the visible text at all, only in its annotation.
 *
 * pdf.js is loaded on demand (not at module scope) so it never runs during Next's server-side
 * prerender of this page — it only touches the DOM/Worker APIs that exist in the browser.
 */
export async function extractYouTubeUrls(file: File): Promise<string[]> {
  const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const found = new Set<string>();
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      for (const match of text.match(URL_PATTERN) ?? []) found.add(clean(match));
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        const uri = (annotation as { url?: string }).url;
        if (uri) found.add(clean(uri));
      }
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
  return [...found].filter((item) => YOUTUBE_HOST.test(item));
}

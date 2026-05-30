// Croatian prompts must be translated to English before they reach FLUX Kontext,
// whose text encoders (T5-XXL + CLIP-L) are English-centric. We only ever send
// the short prompt text — never the image — and always fall back to the original
// text if translation is unavailable, so editing never breaks.

const PROVIDER = (process.env.TRANSLATE_PROVIDER || "mymemory").toLowerCase();

export type Translation = {
  text: string; // text to send to the model (translated, or original on fallback)
  translated: boolean; // whether it actually changed
  original?: string;
};

function looksLikeWarning(s: string): boolean {
  const u = s.toUpperCase();
  return (
    u.includes("MYMEMORY WARNING") ||
    u.includes("QUOTA") ||
    u.includes("PLEASE SELECT")
  );
}

export async function translateToEnglish(
  text: string,
  sourceLocale: string,
): Promise<Translation> {
  const trimmed = text.trim();
  if (!trimmed || PROVIDER === "none" || sourceLocale === "en") {
    return { text, translated: false };
  }
  // Only Croatian is wired up for now.
  if (sourceLocale !== "hr") return { text, translated: false };

  try {
    if (PROVIDER === "mymemory") {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(trimmed) +
        "&langpair=hr|en";
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        responseStatus?: number;
        responseData?: { translatedText?: string };
      };
      if (data.responseStatus && data.responseStatus !== 200) {
        throw new Error(`status ${data.responseStatus}`);
      }
      const out = data.responseData?.translatedText?.trim();
      if (out && !looksLikeWarning(out)) {
        return { text: out, translated: out !== trimmed, original: text };
      }
    }
  } catch (err) {
    console.warn("[translate] failed, using original prompt:", (err as Error).message);
  }
  return { text, translated: false };
}

// Transformers.js stores model files in the Cache Storage bucket named below.
// We inspect it to report a real "downloaded?" status and to delete models.
const TF_CACHE = "transformers-cache";

async function openCache(): Promise<Cache | null> {
  try {
    if (typeof caches === "undefined") return null;
    return await caches.open(TF_CACHE);
  } catch {
    return null;
  }
}

/**
 * Return the set of model ids (from the provided candidates) that have at least
 * one file present in the Transformers.js browser cache.
 */
export async function getCachedTransformersModelIds(
  candidateIds: string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  const cache = await openCache();
  if (!cache) return result;
  try {
    const keys = await cache.keys();
    const urls = keys.map((k) => k.url);
    for (const id of candidateIds) {
      if (urls.some((u) => u.includes(id))) result.add(id);
    }
  } catch {
    /* ignore */
  }
  return result;
}

/** Approximate cached bytes for a model by summing its cached response sizes. */
export async function getTransformersModelBytes(modelId: string): Promise<number> {
  const cache = await openCache();
  if (!cache) return 0;
  let total = 0;
  try {
    const keys = await cache.keys();
    for (const req of keys) {
      if (!req.url.includes(modelId)) continue;
      const res = await cache.match(req);
      if (!res) continue;
      const len = res.headers.get("Content-Length");
      if (len) {
        total += Number.parseInt(len, 10) || 0;
      } else {
        const blob = await res.clone().blob();
        total += blob.size;
      }
    }
  } catch {
    /* ignore */
  }
  return total;
}

/** Delete all cached files for a Transformers.js model id. */
export async function deleteTransformersModel(modelId: string): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    const keys = await cache.keys();
    await Promise.all(
      keys.filter((k) => k.url.includes(modelId)).map((k) => cache.delete(k)),
    );
  } catch {
    /* ignore */
  }
}

import type { CachedModelInfo, AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const DB_NAME = "private-ai-photo-repair";
const DB_VERSION = 1;
const STORE_META = "model-meta";
const STORE_BLOBS = "model-blobs";
const STORE_SETTINGS = "settings";
const SETTINGS_KEY = "app-settings";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "modelId" });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
  return dbPromise;
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function reqResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function putModel(info: CachedModelInfo, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_META, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_META).put(info);
  tx.objectStore(STORE_BLOBS).put(blob, info.storageKey);
  await txComplete(tx);
}

export async function getModelMeta(modelId: string): Promise<CachedModelInfo | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_META, "readonly");
  const result = await reqResult(tx.objectStore(STORE_META).get(modelId));
  return (result as CachedModelInfo | undefined) ?? null;
}

export async function getModelBlobByKey(storageKey: string): Promise<Blob | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, "readonly");
  const result = await reqResult(tx.objectStore(STORE_BLOBS).get(storageKey));
  return (result as Blob | undefined) ?? null;
}

export async function listModelMeta(): Promise<CachedModelInfo[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_META, "readonly");
  const result = await reqResult(tx.objectStore(STORE_META).getAll());
  return (result as CachedModelInfo[]) ?? [];
}

export async function deleteModelRecord(modelId: string): Promise<void> {
  const meta = await getModelMeta(modelId);
  const db = await openDb();
  const tx = db.transaction([STORE_META, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_META).delete(modelId);
  if (meta) tx.objectStore(STORE_BLOBS).delete(meta.storageKey);
  await txComplete(tx);
}

export async function clearAllModels(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_META, STORE_BLOBS], "readwrite");
  tx.objectStore(STORE_META).clear();
  tx.objectStore(STORE_BLOBS).clear();
  await txComplete(tx);
}

export async function updateModelMeta(
  modelId: string,
  patch: Partial<CachedModelInfo>,
): Promise<void> {
  const existing = await getModelMeta(modelId);
  if (!existing) return;
  const db = await openDb();
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ ...existing, ...patch });
  await txComplete(tx);
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_SETTINGS, "readonly");
    const result = await reqResult(tx.objectStore(STORE_SETTINGS).get(SETTINGS_KEY));
    return { ...DEFAULT_SETTINGS, ...((result as Partial<AppSettings> | undefined) ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readwrite");
  tx.objectStore(STORE_SETTINGS).put(settings, SETTINGS_KEY);
  await txComplete(tx);
}

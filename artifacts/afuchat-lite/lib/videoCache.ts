import * as FileSystem from "expo-file-system";

const CACHE_DIR = FileSystem.cacheDirectory + "afuchat_videos/";
const MAX_CACHE_BYTES = 300 * 1024 * 1024; // 300 MB cap

function urlToKey(url: string): string {
  return url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(-120);
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

async function evictIfNeeded(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if ((info as any).size > MAX_CACHE_BYTES) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch {
    // ignore
  }
}

const pendingDownloads = new Map<string, Promise<string>>();
const resolvedCache = new Map<string, string>();

export async function getCachedUri(url: string): Promise<string> {
  if (!url) return url;

  if (resolvedCache.has(url)) return resolvedCache.get(url)!;

  await ensureDir();

  const key = urlToKey(url);
  const localPath = CACHE_DIR + key;

  const info = await FileSystem.getInfoAsync(localPath);
  if (info.exists) {
    resolvedCache.set(url, localPath);
    return localPath;
  }

  if (!pendingDownloads.has(url)) {
    const dl = FileSystem.downloadAsync(url, localPath)
      .then(() => {
        resolvedCache.set(url, localPath);
        pendingDownloads.delete(url);
        evictIfNeeded();
        return localPath;
      })
      .catch(() => {
        pendingDownloads.delete(url);
        return url;
      });
    pendingDownloads.set(url, dl);
  }

  return url;
}

export async function preloadVideos(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map(getCachedUri));
}

export async function clearVideoCache(): Promise<void> {
  resolvedCache.clear();
  pendingDownloads.clear();
  await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
}

export function isCached(url: string): boolean {
  return resolvedCache.has(url);
}

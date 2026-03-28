const cache = new Map<string, string>();

export const ipfsCache = {
  get(cid: string): string | undefined {
    return cache.get(cid);
  },
  set(cid: string, text: string): void {
    cache.set(cid, text);
  },
  has(cid: string): boolean {
    return cache.has(cid);
  },
  size(): number {
    return cache.size;
  },
};

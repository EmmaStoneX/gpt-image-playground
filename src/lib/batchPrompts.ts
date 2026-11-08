export function splitBatchPrompts(text: string): string[] {
  return text.split(/\r?\n[ \t]*\r?\n[ \t]*\r?\n/).map((item) => item.trim()).filter(Boolean)
}

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++]
      await worker(item)
    }
  })
  await Promise.all(runners)
}

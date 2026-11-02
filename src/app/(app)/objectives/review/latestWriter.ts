/**
 * Writes that must land in the order they were asked for (I-13, plan step
 * 5): one request in flight at a time, and while it runs only the newest
 * value waits — never a queue of stale ones. So an older autosave can't land
 * after a newer one, and `flush` resolves once what was last asked for has
 * been written, or failed.
 */
export type LatestWriter<T> = {
  /** Write `value` once whatever is in flight finishes. */
  want(value: T): void;
  /** Resolves when nothing is waiting: true if the last write succeeded. */
  flush(): Promise<boolean>;
};

export function latestWriter<T>(
  send: (value: T) => Promise<boolean>,
): LatestWriter<T> {
  let waiting: { value: T } | null = null;
  let running: Promise<boolean> | null = null;
  let ok = true;

  async function run(): Promise<boolean> {
    while (waiting) {
      const { value } = waiting;
      waiting = null;
      try {
        ok = await send(value);
      } catch {
        ok = false;
      }
    }
    running = null;
    return ok;
  }

  return {
    want(value) {
      waiting = { value };
      if (!running) running = run();
    },
    flush: () => running ?? Promise.resolve(ok),
  };
}

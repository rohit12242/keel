import { describe, expect, it } from "vitest";
import { latestWriter } from "./latestWriter";

/** A send whose requests the test answers one at a time, in order. */
function controlled() {
  const sent: string[] = [];
  const pending: ((ok: boolean) => void)[] = [];
  const send = (v: string) =>
    new Promise<boolean>((resolve) => {
      sent.push(v);
      pending.push(resolve);
    });
  const answer = async (ok = true) => {
    pending.shift()?.(ok);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { sent, send, answer };
}

describe("latestWriter", () => {
  it("sends one at a time, and only the newest of those that waited", async () => {
    const c = controlled();
    const w = latestWriter(c.send);
    w.want("a");
    w.want("b");
    w.want("c");
    expect(c.sent).toEqual(["a"]);
    await c.answer();
    expect(c.sent).toEqual(["a", "c"]);
    const done = w.flush();
    await c.answer();
    expect(await done).toBe(true);
    expect(c.sent).toEqual(["a", "c"]);
  });

  it("reports the last write's failure, and tries again when asked", async () => {
    const c = controlled();
    const w = latestWriter(c.send);
    w.want("a");
    const failed = w.flush();
    await c.answer(false);
    expect(await failed).toBe(false);
    expect(await w.flush()).toBe(false);
    w.want("a");
    await c.answer(true);
    expect(await w.flush()).toBe(true);
  });

  it("treats a thrown send as a failure", async () => {
    const w = latestWriter<string>(() => Promise.reject(new Error("offline")));
    w.want("a");
    expect(await w.flush()).toBe(false);
  });

  it("flushes at once when nothing was asked for", async () => {
    expect(await latestWriter(async () => true).flush()).toBe(true);
  });
});

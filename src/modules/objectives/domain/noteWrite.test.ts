import { describe, expect, it } from "vitest";
import { noteRefusal, validateNoteWrite } from "./noteWrite";

const fields = (r: ReturnType<typeof validateNoteWrite>) =>
  r.ok ? [] : r.error.map((e) => e.field);

describe("validateNoteWrite", () => {
  it("takes a dated line of text", () => {
    expect(
      validateNoteWrite({ written_on: "2026-09-16", text: "Mornings work." }),
    ).toEqual({
      ok: true,
      value: { written_on: "2026-09-16", text: "Mornings work." },
    });
  });

  it("names each bad field", () => {
    expect(fields(validateNoteWrite(null))).toEqual(["written_on", "text"]);
    expect(
      fields(validateNoteWrite({ written_on: "16-09-2026", text: "" })),
    ).toEqual(["written_on", "text"]);
    expect(
      fields(
        validateNoteWrite({ written_on: "2026-09-16", text: "t".repeat(2001) }),
      ),
    ).toEqual(["text"]);
    expect(fields(validateNoteWrite([1]))).toEqual(["written_on", "text"]);
  });
});

describe("noteRefusal", () => {
  it("allows today and earlier, and refuses a later day", () => {
    expect(noteRefusal("2026-09-16", "2026-09-16")).toBeNull();
    expect(noteRefusal("2026-09-01", "2026-09-16")).toBeNull();
    expect(noteRefusal("2026-09-17", "2026-09-16")).toBe("future");
  });
});

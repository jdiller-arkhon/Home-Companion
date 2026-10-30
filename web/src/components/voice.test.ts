import { describe, expect, it } from "vitest";
import { sentences } from "./voice";

describe("sentence chunking for speech", () => {
  it("keeps the first sentence short so speech starts fast, then merges", () => {
    const c = sentences("Good morning, Jordan. It's sunny. The filter is due Sunday. Your package arrives today! Want oat milk?");
    expect(c[0]).toBe("Good morning, Jordan.");
    expect(c.join(" ")).toBe("Good morning, Jordan. It's sunny. The filter is due Sunday. Your package arrives today! Want oat milk?");
    expect(c.length).toBeLessThan(5);
  });
  it("handles text without punctuation", () => {
    expect(sentences("all done")).toEqual(["all done"]);
  });
});

import { describe, expect, it } from "vitest";
import { t2i } from "@/utils/image";

describe("t2i", () => {
  it("builds image url with encoded prompt and size", () => {
    const url = t2i('hello "world"', "square");
    expect(url).toContain("text_to_image?prompt=");
    expect(url).toContain("image_size=square");
    expect(url).toContain("hello%20%22world%22");
  });
});


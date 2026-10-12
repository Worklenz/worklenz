// jest.config.js sets automock: true repo-wide - unmock explicitly so this pure function runs for real.
jest.unmock("../shared/home-mentions");

import { MENTION_EXCERPT_MAX_LENGTH, toMentionExcerpt } from "../shared/home-mentions";

describe("toMentionExcerpt", () => {
  it("returns an empty string for a missing body", () => {
    expect(toMentionExcerpt(null, [])).toBe("");
    expect(toMentionExcerpt(undefined, [])).toBe("");
    expect(toMentionExcerpt("", [])).toBe("");
  });

  it("puts each mentioned person's name back in place of its {n} placeholder", () => {
    const mentions = [
      { index: 0, name: "Ada Lovelace" },
      { index: 1, name: "Grace Hopper" },
    ];
    expect(toMentionExcerpt("{0} and {1}, can you review this?", mentions)).toBe(
      "@Ada Lovelace and @Grace Hopper, can you review this?"
    );
  });

  it("matches a placeholder by its stored index, not by its position in the list", () => {
    const mentions = [{ index: 2, name: "Grace Hopper" }];
    expect(toMentionExcerpt("cc {2}", mentions)).toBe("cc @Grace Hopper");
  });

  it("drops a placeholder it has no name for instead of showing {n}", () => {
    expect(toMentionExcerpt("Hi {3} please look", [])).toBe("Hi please look");
  });

  it("strips markup, keeping the words and a space where a block ended", () => {
    expect(toMentionExcerpt("<p>one</p><p><b>two</b><br/>three</p>", [])).toBe("one two three");
  });

  it("decodes the entities the sanitizer wrote", () => {
    expect(toMentionExcerpt("Tom &amp; Jerry say &quot;a &lt; b&quot;", [])).toBe("Tom & Jerry say \"a < b\"");
  });

  it("never reads a name as markup", () => {
    expect(toMentionExcerpt("{0} hi", [{ index: 0, name: "<b>x</b>" }])).toBe("@<b>x</b> hi");
  });

  it("collapses whitespace and newlines", () => {
    expect(toMentionExcerpt("  a \n\n  b\t c ", [])).toBe("a b c");
  });

  it("truncates a long comment with an ellipsis, within the limit", () => {
    const excerpt = toMentionExcerpt("word ".repeat(200), []);
    expect(excerpt.length).toBeLessThanOrEqual(MENTION_EXCERPT_MAX_LENGTH);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("leaves a comment at the limit untouched", () => {
    const exact = "x".repeat(MENTION_EXCERPT_MAX_LENGTH);
    expect(toMentionExcerpt(exact, [])).toBe(exact);
  });
});

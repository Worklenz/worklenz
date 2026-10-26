import { extractUrls } from "../shared/url-extractor";

describe("extractUrls", () => {
  it("preserves exact href URLs without stripping valid punctuation like parentheses", () => {
    const html = '<a href="https://en.wikipedia.org/wiki/Foo_(bar)">Foo (bar)</a>';
    const urls = extractUrls(html);
    expect(urls).toContain("https://en.wikipedia.org/wiki/Foo_(bar)");
  });

  it("decodes HTML-encoded &amp; in both href and text URLs", () => {
    const html = '<a href="https://example.com/search?q=1&amp;sort=asc">link</a> and text https://example.com/test?a=1&amp;b=2.';
    const urls = extractUrls(html);
    expect(urls).toContain("https://example.com/search?q=1&sort=asc");
    expect(urls).toContain("https://example.com/test?a=1&b=2");
  });

  it("trims trailing sentence punctuation from plaintext URLs", () => {
    const html = '<p>Check out https://worklenz.com, and https://google.com.</p>';
    const urls = extractUrls(html);
    expect(urls).toEqual(["https://worklenz.com", "https://google.com"]);
  });
});

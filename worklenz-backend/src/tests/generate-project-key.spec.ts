import { generateProjectKey } from "../utils/generate-project-key";

describe("generateProjectKey", () => {
  it("uses the initials of the project name", () => {
    expect(generateProjectKey("Website Redesign", [])).toBe("WR");
  });

  it("keeps at most five initials", () => {
    expect(generateProjectKey("AWS ML Engineer (MLA-C01)", [])).toBe("AMEMC");
  });

  it("adds a letter of the name to short initials that are taken", () => {
    expect(generateProjectKey("Website Redesign", ["WR"])).toBe("WRE");
  });

  it("finds a free key when five initials are taken", () => {
    const key = generateProjectKey("AWS ML Engineer (MLA-C01)", ["AMEMC"]);

    expect(key).toBe("AMEMW");
  });

  it("finds a free key of at most five letters when every variant from the name is taken", () => {
    const name = "AWS ML Engineer (MLA-C01)";
    const taken = ["AMEMC", ...[...name.toUpperCase().slice(1).replace(/\s/g, "")].map(char => `AMEM${char}`)];

    for (let i = 0; i < 50; i++) {
      const key = generateProjectKey(name, taken);
      expect(taken).not.toContain(key);
      expect(key).toMatch(/^[A-Z]{1,5}$/);
    }
  });

  it("finds a free key of at most five letters for names in other scripts", () => {
    const key = generateProjectKey("Проект", []);

    expect(key).toMatch(/^[A-Z]{1,5}$/);
  });
});

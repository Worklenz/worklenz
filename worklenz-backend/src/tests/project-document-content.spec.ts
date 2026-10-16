import {
  applyParentMoves,
  convertLegacyDocument,
  extractMentions,
  extractPlainText,
  memberIdsToNotify,
  syncDocumentMentions,
  validateDocumentContent,
  validateDocumentTree,
  readDocumentContent,
  MAX_CONTENT_NESTING,
  canUpdateDocumentContent,
  SectionDocument,
} from "../services/project-documents/project-document-content";

const member = (id: string) => ({ type: "member" as const, id });
const task = (id: string) => ({ type: "task" as const, id });

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMBER_ID = "33333333-3333-4333-8333-333333333333";

describe("syncDocumentMentions", () => {
  it("notifies a member only the first time they are mentioned", () => {
    const first = syncDocumentMentions([], [member(MEMBER_ID), task(TASK_ID)]);
    expect(memberIdsToNotify(first)).toEqual([MEMBER_ID]);
    expect(first.insertedTaskIds).toEqual([TASK_ID]);

    const repeat = syncDocumentMentions(
      [member(MEMBER_ID), task(TASK_ID)],
      [member(MEMBER_ID), task(TASK_ID)]
    );
    expect(memberIdsToNotify(repeat)).toEqual([]);
    expect(repeat.insertedTaskIds).toEqual([]);
    expect(repeat.removedMemberIds).toEqual([]);
  });

  it("drops a removed mention and never notifies for a task mention", () => {
    const diff = syncDocumentMentions(
      [member(MEMBER_ID), task(TASK_ID)],
      [task(TASK_ID), member(OTHER_MEMBER_ID)]
    );

    expect(diff.removedMemberIds).toEqual([MEMBER_ID]);
    expect(memberIdsToNotify(diff)).toEqual([OTHER_MEMBER_ID]);
    expect(memberIdsToNotify(diff)).not.toContain(TASK_ID);
    expect(diff.insertedTaskIds).toEqual([]);
  });
});

let nextId = 100;
const contentId = () => `77777777-7777-4777-8777-${String(nextId++).padStart(12, "0")}`;
const nestedDocument = (): SectionDocument => ({
  version: 2,
  sections: [
    {
      id: contentId(),
      type: "callout",
      content: [{ type: "text", text: "Note" }],
      children: [
        {
          id: contentId(),
          type: "checklist",
          items: [
            {
              id: contentId(),
              checked: true,
              content: [{ type: "memberMention", attrs: { id: MEMBER_ID } }],
              children: [
                {
                  id: contentId(),
                  type: "numberedList",
                  start: 3,
                  items: [
                    {
                      id: contentId(),
                      content: [
                        { type: "text", text: "Nested task " },
                        { type: "taskMention", attrs: { id: TASK_ID } },
                      ],
                      children: [
                        {
                          id: contentId(),
                          type: "paragraph",
                          content: [{ type: "memberMention", attrs: { id: MEMBER_ID } }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe("version 2 document content", () => {
  it("allows upgrades and v2 edits while preventing older clients from overwriting v2 pages", () => {
    const old: SectionDocument = { version: 1, sections: [] };
    const document = nestedDocument();
    expect(canUpdateDocumentContent(old, document)).toBe(true);
    expect(canUpdateDocumentContent(document, document)).toBe(true);
    expect(canUpdateDocumentContent(document, old)).toBe(false);
    expect(canUpdateDocumentContent({ version: 2, sections: [] }, old)).toBe(false);
  });
  it("round-trips nested lists, callouts, IDs, numbering and checklist state through validation and reads", () => {
    const document = nestedDocument();
    expect(validateDocumentContent(document)).toEqual({ ok: true, content: document });
    expect(readDocumentContent(JSON.stringify(document))).toEqual(document);
    // Page duplication stores a copy of the JSON; its contents retain the same schema.
    expect(readDocumentContent(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(extractPlainText(document)).toContain("Nested task");
    expect(extractMentions(document)).toEqual([member(MEMBER_ID), task(TASK_ID)]);
    expect(
      memberIdsToNotify(syncDocumentMentions(extractMentions(document), extractMentions(document))),
    ).toEqual([]);
    expect(memberIdsToNotify(syncDocumentMentions([], extractMentions(document)))).toEqual([
      MEMBER_ID,
    ]);
  });

  it("rejects v2 structures in v1 instead of silently losing their contents", () => {
    const document = nestedDocument();
    expect(validateDocumentContent({ ...document, version: 1 }).ok).toBe(false);
    expect(
      validateDocumentContent({
        version: 1,
        sections: [
          {
            id: contentId(),
            type: "quote",
            content: [],
            children: [{ id: contentId(), type: "paragraph", content: [] }],
          },
        ],
      }).ok,
    ).toBe(false);
    expect(validateDocumentContent({ version: 3, sections: [] }).ok).toBe(false);
  });

  it("rejects duplicate IDs across nesting boundaries and unsupported nested sections", () => {
    const id = contentId();
    expect(
      validateDocumentContent({
        version: 2,
        sections: [
          { id, type: "callout", content: [], children: [{ id, type: "paragraph", content: [] }] },
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentContent({
        version: 2,
        sections: [
          {
            id: contentId(),
            type: "quote",
            content: [],
            children: [{ id: contentId(), type: "script", content: [] }],
          },
        ],
      }).ok,
    ).toBe(false);
  });

  it("bounds content nesting and document size", () => {
    let document: SectionDocument = {
      version: 2,
      sections: [{ id: contentId(), type: "paragraph", content: [] }],
    };
    for (let index = 0; index < MAX_CONTENT_NESTING; index++)
      document = {
        version: 2,
        sections: [{ id: contentId(), type: "callout", content: [], children: document.sections }],
      };
    expect(validateDocumentContent(document).ok).toBe(true);
    expect(
      validateDocumentContent({
        version: 2,
        sections: [{ id: contentId(), type: "callout", content: [], children: document.sections }],
      }).ok,
    ).toBe(false);
    expect(
      validateDocumentContent({
        version: 2,
        sections: [{ id: contentId(), type: "code", text: "a".repeat(512 * 1024) }],
      }).ok,
    ).toBe(false);
  });

  it("sanitizes unsafe nested links and rejects invalid numbering", () => {
    const result = validateDocumentContent({
      version: 2,
      sections: [
        {
          id: contentId(),
          type: "callout",
          content: [],
          children: [
            {
              id: contentId(),
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Unsafe",
                  marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok && "children" in result.content.sections[0])
      expect(result.content.sections[0].children?.[0]).toMatchObject({
        content: [{ type: "text", text: "Unsafe" }],
      });
    for (const start of [-1, 0, 1.5, "3", 2147483648])
      expect(
        validateDocumentContent({
          version: 2,
          sections: [{ id: contentId(), type: "numberedList", start, items: [] }],
        }).ok,
      ).toBe(false);
  });

  it("preserves nested legacy lists, callouts, code and mention IDs during conversion", () => {
    const document = convertLegacyDocument({
      type: "doc",
      content: [
        {
          type: "callout",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Legacy note" }] },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "memberMention", attrs: { id: MEMBER_ID } }],
                    },
                    {
                      type: "orderedList",
                      attrs: { start: 2 },
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "taskMention", attrs: { id: TASK_ID } }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: "codeBlock",
              attrs: { language: "typescript" },
              content: [{ type: "text", text: "const a = 1;" }],
            },
          ],
        },
      ],
    });
    expect(document.version).toBe(2);
    expect(validateDocumentContent(document)).toEqual({ ok: true, content: document });
    expect(extractPlainText(document)).toContain("const a = 1;");
    expect(extractMentions(document)).toEqual([member(MEMBER_ID), task(TASK_ID)]);
    expect(document.sections[0]).toMatchObject({
      type: "callout",
      children: [
        expect.objectContaining({ type: "bulletList" }),
        expect.objectContaining({ type: "code", language: "typescript" }),
      ],
    });
  });
});

describe("validateDocumentTree", () => {
  it("rejects a cycle", () => {
    const result = validateDocumentTree([
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects a tree deeper than 5 levels", () => {
    const items = [
      { id: "1", parentId: null },
      { id: "2", parentId: "1" },
      { id: "3", parentId: "2" },
      { id: "4", parentId: "3" },
      { id: "5", parentId: "4" },
      { id: "6", parentId: "5" },
    ];
    expect(validateDocumentTree(items).ok).toBe(false);
  });

  it("rejects a move that would parent a page under its descendant", () => {
    const result = applyParentMoves(
      [
        { id: "parent", parentId: null },
        { id: "child", parentId: "parent" },
      ],
      [{ id: "parent", parentId: "child" }]
    );
    expect(result.ok).toBe(false);
  });
});

const SECTION_ID = "44444444-4444-4444-8444-444444444444";
const ITEM_ID = "55555555-5555-4555-8555-555555555555";

describe("validateDocumentContent", () => {
  it("keeps member and task mention ids and extracts them once", () => {
    const result = validateDocumentContent({
      version: 1,
      sections: [
        {
          id: SECTION_ID,
          type: "paragraph",
          content: [
            { type: "memberMention", attrs: { id: MEMBER_ID } },
            { type: "text", text: " see " },
            { type: "taskMention", attrs: { id: TASK_ID } },
            { type: "memberMention", attrs: { id: MEMBER_ID } },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractMentions(result.content)).toEqual([
      member(MEMBER_ID),
      task(TASK_ID),
    ]);
    expect(extractPlainText(result.content)).toContain("see");
  });

  it("rejects an unsupported section and strips unsafe links", () => {
    expect(
      validateDocumentContent({
        version: 1,
        sections: [{ id: SECTION_ID, type: "codeBlock", text: "x" }],
      }).ok
    ).toBe(false);

    const linked = validateDocumentContent({
      version: 1,
      sections: [
        {
          id: SECTION_ID,
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "bad",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const paragraph = linked.content.sections[0];
    if (paragraph.type !== "paragraph") return;
    expect(paragraph.content[0].marks).toBeUndefined();
  });

  it("rejects a block node inside a text section", () => {
    expect(
      validateDocumentContent({
        version: 1,
        sections: [
          {
            id: SECTION_ID,
            type: "paragraph",
            content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "No" }] }],
          },
        ],
      }).ok
    ).toBe(false);
  });

  it("keeps checklist state and ignores mentions inside code", () => {
    const result = validateDocumentContent({
      version: 1,
      sections: [
        {
          id: SECTION_ID,
          type: "checklist",
          items: [{ id: ITEM_ID, checked: true, content: [{ type: "text", text: "Done" }] }],
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          type: "code",
          text: MEMBER_ID,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(extractMentions(result.content)).toEqual([]);
    const checklist = result.content.sections[0];
    if (checklist.type !== "checklist") return;
    expect(checklist.items[0].checked).toBe(true);
  });
});

describe("convertLegacyDocument", () => {
  it("turns a saved TipTap document into sections", () => {
    const converted = convertLegacyDocument({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
        { type: "paragraph", content: [{ type: "text", text: "Notes" }] },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] }],
        },
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }] }],
        },
        {
          type: "taskList",
          content: [{
            type: "taskItem",
            attrs: { checked: true },
            content: [{ type: "paragraph", content: [{ type: "memberMention", attrs: { id: MEMBER_ID } }] }],
          }],
        },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Quoted" }] }] },
        { type: "horizontalRule" },
        { type: "codeBlock", content: [{ type: "text", text: "skip" }] },
      ],
    });

    expect(converted.version).toBe(1);
    expect(converted.sections.map(section => section.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "numberedList",
      "checklist",
      "quote",
      "divider",
      "code",
    ]);
    const heading = converted.sections[0];
    if (heading.type !== "heading") return;
    expect(heading.level).toBe(2);
    const checklist = converted.sections[4];
    if (checklist.type !== "checklist") return;
    expect(checklist.items[0].checked).toBe(true);
    expect(extractMentions(converted)).toEqual([member(MEMBER_ID)]);
    expect(extractPlainText(converted)).toContain("Quoted");
    expect(extractPlainText(converted)).toContain("skip");
  });

  it("treats an empty saved document as no sections", () => {
    expect(convertLegacyDocument({
      type: "doc",
      content: [{ type: "paragraph" }],
    })).toEqual({ version: 1, sections: [] });
  });
});

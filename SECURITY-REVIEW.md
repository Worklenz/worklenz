# Security Review: Plain-Text Sanitization

## Finding

| Severity | Confidence | Status | Area |
|---|---:|---|---|
| Medium | 9/10 | Fixed | Entity decoding in `sanitizePlainText` |

`sanitizePlainText` stripped HTML tags and then decoded the entities emitted by
`sanitize-html`. Entity-encoded markup in a user-controlled name could therefore
become raw HTML after storage. Notification email templates include task and
team names using unescaped Pug output, allowing the decoded markup to be
interpreted as email HTML. The related CodeQL double-unescaping alert has the
same root cause.

## Resolution

Removed the entity-decoding pass and retained `sanitize-html`'s escaped output.
This keeps encoded markup inert in unescaped email-template insertions and
preserves the existing stored-name format used by search and frontend display
code.

Added regression coverage for stripping HTML while preserving escaped text and
for keeping entity-encoded markup inert.

## Verification

`npm test -- --runInBand src/__tests__/sanitize-plain-text.test.ts src/tests/home-task-query-builder.spec.ts`

Result: 2 suites passed; 34 tests passed.

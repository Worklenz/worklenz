# CSV Task Import – Final Fixes

Implemented fixes for the bulk CSV task import feature.

## Fixed

- Automatic delimiter detection is now persisted into the wizard, so semicolon/tab/pipe CSVs use the same delimiter during preview and backend ingestion.
- Backend CSV parsing now normalizes BOM and CRLF/CR line endings to match frontend behavior.
- Added pre-import validation for empty task titles.
- Added pre-import validation for invalid due dates, including impossible calendar dates such as `2026-02-30`.
- Added assignee email validation when the user chooses to add/import users.
- Added status mapping warnings when a populated status value has not been mapped and would otherwise fall back to the project default.
- Final review now displays validation errors/warnings and shows the actual mapped Title, Status, Assignee and Due Date values that will be created.
- Backend task creation now rejects empty titles and invalid due dates instead of silently creating placeholder/incorrect data.
- Added frontend and backend regression tests for delimiter handling, validation, quoted CSV rows, CRLF, and date parsing.

## Verification note

The uploaded project did not contain a complete dependency installation. An attempted dependency installation/test run timed out in the execution environment, so a full production build/test pass could not be completed here. The source changes and regression tests were added directly to the project.

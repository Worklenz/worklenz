Locale maintenance
==================

English (`public/locales/en`) defines the translation keys. Every namespace and
key must also exist in Albanian (`alb`), German, Spanish, French, Polish,
Portuguese, and Simplified Chinese. Preserve `{{interpolation}}` variables.

Run `npm run prebuild` to validate JSON, check source usage, compare all languages,
and detect copied English text. These checks and the locale regression tests run
before builds and fail on errors.
Run `npm run locales:test` for the localization checker and reported-key regressions.
Frontend resource checks always run, including in frontend-only checkouts and
Docker builds. The regression tests also validate sibling backend locale copies
when `worklenz-backend/src/public/locales` exists; when it is absent, they report
that only frontend resources are being checked. Missing files within a present
backend locale directory still fail validation. Pull request CI builds the
frontend Dockerfile using only `worklenz-frontend` as its context.

The source usage check resolves literal calls bound to `useTranslation`, aliases,
namespace constants, explicit namespace overrides, and key prefixes. It also
checks translators passed through import wizard components. Dynamic keys and
translators passed through other props require review; the static check cannot
resolve them. A `defaultValue` does not replace adding a translated key.

The backend's `src/public/locales` contains older overlapping UI namespaces served
in development. When adding keys in a namespace present there, update its copies
for all eight languages too. Frontend locale files are copied into frontend builds.

Only allow identical English values for technical identifiers or valid shared
spellings; language-specific exceptions belong in `LANGUAGE_SOURCE_VALUES` in
`check-untranslated-locales.js`.

The development missing-key handler waits for initialization and namespace
loading before warning. With React Suspense disabled, an early render can use
a fallback while resources load; this is not a missing translation. The handler
still warns for unresolved keys after loading finishes.

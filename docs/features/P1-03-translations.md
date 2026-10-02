# P1-03 AI translation and language auto-detect (+ guest part of P0-05)

**Status:** done for the guest menu (pitch build); owner dashboard stays French (P0-05 remainder).

## Built
- `nameI18n` on categories, `nameI18n` and `descriptionI18n` on dishes (JSON keyed by fr, ar, en, de, it, ru), `aiLocales` flags.
- `POST /ai/translate-menu { locale }` (OpenRouter, existing keys and model list): batches of 30, Tunisian dish glossary (brik, lablabi, ojja… kept with a short explanation), JSON output validated, results flagged "IA".
- Owner: "Traduire" dialog in the menu editor, per-dish translation fields with "IA · à vérifier" and a "Vérifiée" tick; changing the French text flags the other languages again ("à revoir").
- Restaurant settings: menu languages and default language.
- Guest: language picker showing language names (not flags); language order: saved choice → phone languages → restaurant default → French; Arabic switches the page to right-to-left; prices stay left-to-right. Guest interface strings in French, Arabic and English.

## Acceptance
- [x] Each translated field is marked "IA" until the owner edits or validates it
- [x] Changing the source text marks that field's translations "à revoir" (e2e)
- [x] Guest language picker shows language names
- [x] Guest menu opens in the phone's language when the menu has it

Limits: AI translation needs a working OpenRouter key on the server (QUESTIONS Q1); entitlement `menu.ai_translate` not enforced (P0-03).

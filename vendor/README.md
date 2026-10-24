# Local browser assets

All assets are served locally. No build or runtime CDN is required.

| Package | Pinned version | License | Source / reference |
| --- | --- | --- | --- |
| Marked | 17.0.5 | MIT | Existing `marked.umd.js`; https://marked.js.org/using_pro |
| DOMPurify | See bundled file header | Apache-2.0 / MPL-2.0 | Existing `purify.min.js`; https://github.com/cure53/DOMPurify |
| js-yaml | See bundled file header | MIT | Existing `js-yaml.min.js`; https://github.com/nodeca/js-yaml |
| Lucide | 0.468.0 | ISC | npm `lucide@0.468.0`, `dist/umd/lucide.min.js`; https://lucide.dev/ |
| Highlight.js | 11.11.1 | BSD-3-Clause | npm `@highlightjs/cdn-assets@11.11.1`, common browser bundle; https://highlightjs.readthedocs.io/en/latest/api.html |
| KaTeX | 0.16.22 | MIT | npm `katex@0.16.22`, `dist/katex.min.{js,css}` and complete `dist/fonts/`; https://katex.org/docs/options |

License text is retained alongside these assets. KaTeX is invoked with `trust: false` and bounded expansion. Article HTML is sanitized with DOMPurify before code, formulas, and reader controls are added. Unknown code languages remain plain text, and unavailable renderers leave the source readable.

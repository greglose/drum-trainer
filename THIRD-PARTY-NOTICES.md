# Third-party notices

The built page embeds the Latin subsets of these fonts as base64 `@font-face` data, taken from
the `@fontsource/*` packages at build time. Each is licensed under the SIL Open Font License
1.1 (OFL), which permits embedding and redistribution; the full licence text ships in each
package under `node_modules/@fontsource/<name>/LICENSE` and at
https://openfontlicense.org/open-font-license-official-text/.

| Font | Designer / foundry | Used by |
|---|---|---|
| Bungee | David Jonathan Ross | Sunset Strip controls |
| Monoton | Vernon Adams | Sunset Strip title |
| Anton | Vernon Adams | Spandex and Leopard, Arena Rig |
| Rubik Mono One | Hubert and Fischer, Meir Sadan, Cyreal | Mixtape |
| Permanent Marker | Font Diner | Mixtape title tag and pattern name |

The OFL requires that the fonts, when redistributed, are not sold by themselves and keep their
reserved font names; embedding them in this page does neither. Everything else in this repo is
original work under the MIT licence in `LICENSE`.

`axe-core` (Mozilla Public License 2.0) is a development dependency used only by the smoke test;
it is not part of the built page.

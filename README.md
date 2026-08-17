# gollum2pdf

Render a single [Gollum](https://github.com/gollum/gollum) wiki page to a PDF —
cover, header/footer, code highlighting, embedded images. Runs as a Docker image
(node ≥ 18 + `wkhtmltopdf` ≥ 0.12.6; entrypoint `node src/cli/gollum2pdf-cli.js`).

## Run

```bash
docker run --rm -v /path/to/wiki:/wiki:ro -v "$PWD/out:/out" gollum2pdf \
  /wiki <page-path> /out/<file>.pdf \
  -t "Title" -a /gollum2pdf/assets -c /gollum2pdf/assets/smooth-archive-cover.pdf
```

`<page-path>` is relative to the wiki root. Assets (`header.html`, `footer.html`,
`css/`) and a default cover ship at `/gollum2pdf/assets`.

## Switches

```
gollum2pdf [options] <wiki-dir> <page-path> <pdf-file>
```

| Option | Default | Meaning |
|--------|---------|---------|
| `-t, --title <title>` | `wiki2pdf` | document title |
| `-a, --assets-dir <dir>` | `./assets` | dir with `header.html`, `footer.html`, `css/` |
| `-c, --cover-pdf <pdf>` | — | cover PDF, prepended via ghostscript |
| `-b, --page-break-max-level <n>` | `1` | no page break for pages deeper than level `n` |
| `--title-toc-max-level <n>` | `2` | title-page TOC depth (`0` = off) |
| `--page-toc-max-level <n>` | `0` | per-page TOC depth (`0` = off) |
| `--page-toc-generate-for-max-level <n>` | `2` | generate per-page TOC up to level `n` |
| `-v, --verbose` | — | verbose |

> Needs `wkhtmltopdf >= 0.12.6` local-file-access (`enableLocalFileAccess`, in `src/pdf-renderer.js`).

Renders one page. Full `http(s)://` links (including `https://docs.j4care.com/…`) stay clickable;
gollum `[[wiki links]]` are inlined when the target page resolves, otherwise shown as plain text.

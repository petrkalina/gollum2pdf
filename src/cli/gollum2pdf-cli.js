"use strict"

const program = require('commander'),
    Gollum2pdf = require('../gollum2pdf'),
    path = require('path')


class Gollum2pdfCli {

  constructor () {

    // version an be taken from package version..
    this.program = program.version(1.0)

        .usage('[options] <wiki-dir> <page-path> <pdf-file>')
        .description('Convert a gollum wiki page to PDF')

        .option("-c, --cover-pdf <pdf-file>", "Cover PDF")
        .option("-t, --title <title>", "Document title", "wiki2pdf")
        .option("-a, --assets-dir <assets-dir>", "Directory with header.html, footer.html and css directory with styles", "./assets")

        .option("-b, --page-break-max-level <level>", "Do not insert page breaks for pages with higher level")
        .option("--title-toc-max-level <title-toc-max-level>", "Title TOC max page level")
        .option("--page-toc-max-level <title-toc-max-level>", "Page TOC max page level")
        .option("--page-toc-generate-for-max-level <title-toc-generate-for-max-level>", "Title TOC max page level")

        .option("-v --verbose", "Verbose mode")
  }

  run() {
    this.program.parse(process.argv)
    if (!this.program.args.length) {
      this.program.help()
    }

    let programOpts = {

      // root path
      wikiRootPath: this.program.args[0],
      rootPagePath: this.program.args[1],
      pdfFile: this.program.args[2],

      pdfCover: this.program.coverPdf,
      title: this.program.title,
      assetsDir: this.program.assetsDir,

      cssDir: path.join(this.program.assetsDir, "css"),
      jsDir: path.join(this.program.assetsDir, "js"),

      pageBreakMaxLevel: this.program.pageBreakMaxLevel ? parseInt(this.program.pageBreakMaxLevel) : 1,
      // max level for generated TOC - 0 to disable
      titleTocMaxLevel: this.program.titleTocMaxLevel ? parseInt(this.program.titleTocMaxLevel) : 2,
      // disable page TOC by default
      pageTocMaxLevel: this.program.pageTocMaxLevel ? parseInt(this.program.pageTocMaxLevel) : 0,
      pageTocGenerateForMaxLevel: this.program.pageTocGenerateForMaxLevel ? parseInt(this.program.pageTocGenerateForMaxLevel) : 2,

      // not yet added to interface
      htmlFile: path.join("/tmp/gollum2pdf.html")

      // the idea is to replace references in styles ?? that's shit. the styles HAVE to work on both sides..
      // the paths have to work - which mean wkhtml2pdf has to be invoked in the wiki root dir
      // but currently this does not work here!

    }

    let gollum2pdf = new Gollum2pdf(programOpts)

    // render html
    let htmlFile = programOpts.htmlFile
    let html = gollum2pdf.renderHtml(htmlFile)

    // render PDF (out file is used in pipe at the end of command..)
    let pdfFile = programOpts.pdfFile
    gollum2pdf.renderPdf(html, pdfFile)

  }

}

if (require.main === module) {
  new Gollum2pdfCli().run()
}

module.exports = Gollum2pdfCli

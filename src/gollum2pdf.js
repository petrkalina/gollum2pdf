'use strict'

const HtmlRenderer = require('./html-renderer'),
    PdfRenderer = require('./pdf-renderer'),
    PageNode = require('./page-node')

class Gollum2pdf
{
  constructor(programOpts) {
    this.programOpts = programOpts

    let path = programOpts.rootPagePath
    let title = programOpts.title

    this.root = new PageNode(path, title, path, programOpts)
    this.nodes = new Map()
    this.nodes.set(path, this.root)

    this.root.extractChildren(this.nodes)

    console.log("Extraction finished, page tree is:")
    this.nodes.forEach(node => {
          console.log(node.toString())
        }
    )
  }

  renderHtml(htmlOutFile) {
    // build html elements
    let htmlRenderer = new HtmlRenderer(this.root, this.nodes, this.programOpts)
    return htmlRenderer.renderPages(htmlOutFile)
  }

  renderPdf(html, pdfOutFile) {
    // todo: other options process after
    // let footer = this.converter.getOption('footer')
    // let pdfPageCount = this.converter.getOption('pdfPageCount')

    let wkhtml2pdfOptions = {
      toc: false, outline: true,
      marginLeft: 10, marginRight: 10,
      footerLine: false, footerSpacing: 2.5,
      footerFontSize: 10, pageOffset: 0
    }
    //if (footer) {
    //  wkhtml2pdfOptions.footerLeft = footer
    //}
    //if (pdfPageCount) {
    //  wkhtml2pdfOptions.footerRight = "[page]/[toPage]"
    //}

    let pdfRenderer = new PdfRenderer(wkhtml2pdfOptions)
    pdfRenderer.renderPdf(html, pdfOutFile)
  }
}

module.exports = Gollum2pdf

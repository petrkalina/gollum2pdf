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
    let pdfRenderer = new PdfRenderer(this.programOpts)
    pdfRenderer.renderPdf(html, pdfOutFile)
  }
}

module.exports = Gollum2pdf

'use strict'

const find = require('find'),
    util = require('util'),
    fs = require('fs'),
    marked = require('marked'),
    PageNode = require('./page-node'),
    highlight = require('highlight.js'),
    datauri = require('datauri').sync


class HtmlRenderer
{
  // from markdown link function output
  constructor(rootNode, nodesMap, programOpts) {
    this.rootNode = rootNode
    this.nodesMap = nodesMap
    this.programOpts = programOpts

    // state when rendering a page
    this.pageIdAttached = false
    this.nodes = null
  }

  renderPages(htmlFile) {

    // serialise nodes by dfs
    let nodeList = new Array()
    PageNode.dfs(this.rootNode, nodeList)

    // render pages
    let html = this.buildHeader()
    nodeList.forEach(node => {
      let nodeHtml = this.renderPage(node)
      //console.debug("appending: " + nodeHtml)
      html += nodeHtml
    }, this)

    html += this.buildFooter()

    if (htmlFile)
      fs.writeFileSync(htmlFile, html)

    return html
  }

  renderPageToc(node)
  {
    let html = `<div class="toc">
    <div class="toc-title">Table of Contents</div>
    <ul>`

    // render items
    let rendered = null
    node.toc.forEach(tocItem => {
      if (rendered) {
        let shiftToNext = tocItem.level - rendered.level

        if (shiftToNext > 0) {
          html += `<li><a href="${rendered.href}">${rendered.text}</a>`
          for (let i = 0; i < shiftToNext; i++)
            html += "<ul>"
        } else if (shiftToNext < 0) {
          html += `<li><a href="${rendered.href}">${rendered.text}</a></li>`
          for (let i = 0; i > shiftToNext; i--)
            html += "</ul>"
          html += "</li>"
        } else
          html += `<li><a href="${rendered.href}">${rendered.text}</a></li>`
      }
      rendered = tocItem
    })

    // render last item
    let shiftToNext = this.level - rendered.level + 1
    html += `<li><a href="${rendered.href}">${rendered.text}</a></li>`
    for (let i = 0; i > shiftToNext; i--)
      html += "</ul>"
    html += "</li>"

    // end
    html += `
    </ul>
    </div>`

    return html
  }

  renderPage(node)
  {
    console.debug(`Rendering page node: ${node.toString()} `)

    let md = PageNode.normaliseMd(node.readMd())

    // state passed to / maintained by renderer callbacks
    this.pageIdAttached = false
    this.pageNode = node
    return marked(md, {renderer: this.getPageRenderer()})
  }

  getPageRenderer()
  {
    let self = this

    if (!this.pageRenderer) {
      this.pageRenderer = new marked.Renderer()

      // optionally insert i.e. X.Y.Z to headings (... only the ones for which there are nodes present!)
      this.pageRenderer.heading = function (text, level) {
        const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-')

        // offset headers by level
        level += self.pageNode.level

        let headerAttrs = ""
        let toc = ""
        if (!self.pageIdAttached) {
          // attach id to the first heading
          self.pageIdAttached = true
          let pageBreak = ""
          if (self.pageNode.level <= self.programOpts.pageBreakMaxLevel) {
            pageBreak = `style="page-break-before: always !important;"`
          }

          headerAttrs=`id="${self.pageNode.id}" ${pageBreak}`

          // attach toc to the first heading
          if (self.pageNode.mdOpts.toc)
            toc = self.renderPageToc(self.pageNode)
        }

        return `
          <h${level} ${headerAttrs}>
            <a name="${escapedText}" class="anchor" href="#${escapedText}">
              <span class="header-link"></span>
            </a>
            ${text}
          </h${level}>
        
          ${toc}`
      }

      this.pageRenderer.code = function (code, lang) {
        if (lang && highlight.getLanguage(lang)) {
          code = highlight.highlight(lang, code, true)
        } else {
          code = highlight.highlightAuto(code)
        }
        return `<pre class="hljs">${code.value}</pre>`
      }

      this.pageRenderer.link = function (href, title, text) {
        // internal links (shuold also allow other extensions here!!)
        if (!href.match(/^https?:\/\//)) {
          // internal links are via #
          let node = self.nodesMap.get(href)
          if (node) {
            href = '#' + node.id
          } else if (!href.startsWith("#")) {
            // link to page that was not found
            return `<span class="disabled-link">${text}</span>`
          }
        }
        // external link remain..
        return `<a href="${href}">${text}</a>`

        // todo: add support for gollum images
      }

      this.pageRenderer.image = function (href, title, text) {
        if (!href.match(/^https?:\/\//)) {
          // transform internal images into data URI
          let imagePath = self.getImageFilePath(href)
          let dataURI = "detauri_error"
          try {
            dataURI = datauri(imagePath)
          } catch (e) {
            console.warn("Error resolving Image Path: ".concat(href))
          }
          return util.format('<img alt="%s" src="%s" />', text, dataURI)
        } else {
          return util.format('<img alt="%s" src="%s" />', text, href)
        }
      }
    }

    return this.pageRenderer

  }

  buildCss() {
    let css = ""
    let format = '<style>%s</style>'

    let files = find.fileSync(new RegExp(".css"), this.programOpts.cssDir)
    files.forEach(file => {
      css += util.format(format, fs.readFileSync(file).toString()).concat('\n')
    })

    return css
  }

  buildJs() {
    return ""
  }

  buildHeader() {
    var htmlHeader = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${this.programOpts.title}</title>
    ${this.buildCss()}
    ${this.buildJs()}
  </head>
  <body id="page-top" class="pdf-doc">
    <div class='covertitle'>
      <b>${this.programOpts.title}</b>
    </div>
`

    return htmlHeader
  }

  buildFooter() {
    var footer = `
  </body>
</html>`

    return footer
  }
}

module.exports = HtmlRenderer

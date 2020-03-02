'use strict'

const marked = require('marked'),
    fs = require('fs-extra'),
    util = require('util'),
    path = require('path'),
    datauri = require('datauri').sync,
    highlight = require('highlight.js'),
    find = require('find'),
    wkhtmltopdf = require('wkhtmltopdf'),
    HtmlBuilder = require('./html-builder'),
    PageNode = require('./page-node')


class Gollum2pdf
{

  constructor(wikiRootPath, options) {
    this.wikiRootPath = wikiRootPath
    this.options = options

    // state when rendering a page
    this.pageIdAttached = false
    this.pageId = null
    this.pageLevelOffset = 0

    if (this.options.refTracingRootPagePath) {
      // href and path are the same for the root node..
      let path = options.refTracingRootPagePath
      let title = options.refTracingRootPageTitle

      this.nodes = new Map()
      this.root = new PageNode(path, title, path)
      this.nodes.set(path, this.root)

      // innit nodes
      // renderer is parameterized by the parent paramater
      // the link callback cannot be parameterized, so it would have to be a property of the renderer that is set before calling the rendering
      // .. so for the moment it is like this
      this.extractChidren(this.root, this.nodes)

      console.log("Extraction finished, page tree is:")
      this.nodes.forEach(node => {
            console.log(node.toString())
          }
      )
      // .. make non-static..
    }
    else {
      console.error("Invalid Arguments..")
    }

  }

  renderHtml() {

    let nodeList = new Array()
    Gollum2pdf.dfs(this.root, nodeList)

    console.log("Serialization finished - serialised node list:")
    nodeList.forEach(node => {
      console.log(node.toString())
    })

    let htmlBuilder = new HtmlBuilder(this.options)
    let html = htmlBuilder.buildHeader()

    // render TOC
    // let prev = null
    // nodeList.forEach(node => {
    //   // this does not work yet somehow
    //   //if (node.level <= this.options.refTracingTocMaxLevel) {
    //     let nodeHtml = this.renderTocItem(node, prev)
    //     //console.debug("appending: " + nodeHtml)
    //     html += nodeHtml
    //   //}
    //   prev = node
    // }, this)

    // render pages
    nodeList.forEach(node => {
      let nodeHtml = this.renderPage(node)
      //console.debug("appending: " + nodeHtml)
      html += nodeHtml
    }, this)

    html += htmlBuilder.buildFooter()
    return html
  }

  renderPdf(html, pdfFile)
  {
    // todo: other options process alter
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

    return new Promise(function (resolve, reject) {
      wkhtmltopdf(html, wkhtml2pdfOptions)
          .on('end', function () {
            console.info('pdf conversion finished: %s', pdfFile)
            resolve(pdfFile)
          })
          .on('error', reject)
          .pipe(fs.createWriteStream(pdfFile))
    })
  }

  // references: wikiRootPath, node, nodes
  getPageRenderer()
  {
    let self = this
    if (!this.pageRenderer) {
      this.pageRenderer = new marked.Renderer()

      // optionally insert i.e. X.Y.Z to headings (... only the ones for which there are nodes present!)
      this.pageRenderer.heading = function (text, level) {
        const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

        // offset headers by level
        level += self.pageLevelOffset

        // attach id to the first heading
        let idText = ""
        if (!self.pageIdAttached) {
          self.pageIdAttached = true
          idText = `id="${self.pageId}"`
        }

        return `
          <h${level}>
            <a name="${escapedText}" class="anchor" href="#${escapedText}">
              <span ${idText} class="header-link"></span>
            </a>
            ${text}
          </h${level}>`
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
        let node = self.nodes.get(href)

        // internal links are via #
        if (node) {
          href = '#' + node.id
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

  renderPage(node)
  {
    // this has to be your code, including level!!
    let md = node.getNormMd()

    // todo: improve .. prepend header for the page
    // let pageIdAnchor=`<h1 id="${node.id}" style="page-break-before: always !important;">${node.text}</h1>`
    let pageIdAnchor=""

    // state passed to / maintained by renderer callbacks
    this.pageIdAttached = false
    this.pageId = node.id
    this.pageLevelOffset=node.level
    let pageHtml = marked(md, {renderer: this.getPageRenderer()})

    return pageIdAnchor.concat(pageHtml)
  }

  renderTocItem(node, prev)
  {
    let html = ""

    // if root, ignore..
    if (prev) {
      let shift = node.level - prev.level

      if (shift > 1)
        console.error("Wrong level shift in TOC:" + shift)

      // sub-list
      if (shift === 1) {
        html += "<ul>"
      }

      // indent
      for (let i = 0; i < node.level; i++) {
        html += "  "
      }

      // item
      html += `<li><a href="#${node.id}">${node.text}</a></li>`

      // close sublists all the way to the current level
      if (shift < 0) {
        for (let i = 0; i > shift; i--) {
          html += "</ul>"
        }
      }
    }

    return html
  }

  getMdFilePath(href) {
    // replicate gollum refs by searching for canonical name..
    let gollumPattern = href
        .replace(" ", "-")
        .replace("(","\\(")
        .replace(")", "\\)")
        .concat(".md")

    let files = find.fileSync(new RegExp(gollumPattern), this.wikiRootPath)
    if (files.length !== 1) {
      //console.error("Page: Error getting path for href=" + href + ", matches: " + files)
      return "not-found"
    }

    return files[0]
  }

  getImageFilePath(href) {
    // replicate gollum refs by searching for canonical name..
    let gollumPattern = href
        .replace("(", "\\(")
        .replace(")", "\\)")

    let files = find.fileSync(new RegExp(gollumPattern), this.wikiRootPath)
    if (files.length !== 1) {
      console.error("Image: Error getting path for href=" + href + ", matches: " + files)
      return "not-found"
    }

    return files[0]
  }

  extractChidren(parent, nodes) {
    console.log("extracting children of: " + parent.toString())

    let converter = this

    // setup once only outside this block
    let refRenderer = new marked.Renderer()

    // extract first heading
    refRenderer.heading = function (text, level) {
      if (!parent.heading)
        parent.heading = text
    }

    // if new min depth for linked page, create child
    // .. will be parsed as part of next recursion
    refRenderer.link = function(href, title, text) {
      // links are normalised alredy. recognise internal links:
      if (!href.match(/^https?:\/\//)) {
        let prev = nodes.get(href)
        let level = parent.level + 1
        if (!prev) {
          let mdFilePath = converter.getMdFilePath(href)
          if (mdFilePath !== "not-found") {
            // title seems not to be the right field..
            let x = new PageNode(href, text, mdFilePath)
            parent.addChild(x)
            nodes.set(href, x)
            converter.extractChidren(x, nodes)
          }
        } else {
          if (level < prev.level) {
            prev.parent.removeChild(prev)
            // levels corrected on addChild operation for whole subtree..
            parent.addChild(prev)
          }
        }
      }
    }

    marked(parent.getNormMd(), { renderer: refRenderer })
  }

  static dfs(parent, nodeList)
  {
    nodeList.push(parent)
    parent.children.forEach(child => {Gollum2pdf.dfs(child, nodeList)})

    return nodeList
  }
}

module.exports = Gollum2pdf

'use strict'

const marked = require('marked'),
    fs = require('fs-extra'),
    util = require('util'),
    path = require('path'),
    datauri = require('datauri').sync,
    highlight = require('highlight.js'),
    find = require('find'),
    wkhtmltopdf = require('wkhtmltopdf'),
    HtmlBuilder = require('./html-builder')


class PageNode
{
  // from markdown link function output
  constructor(href, text, path) {
    this.href = href
    this.text = text
    this.path = path
    this.level = 0
    this.id = PageNode.getPageIdFromFilenameOrLink(this.path)

    // for ref tracing
    this.parent = null
    this.children = []
  }

  removeChild(node)
  {
    let i = this.children.indexOf(node)
    this.children.splice(i)
    node.parent = null
  }

  addChild(node)
  {
    this.children.push(node)
    node.parent = this

    // needs to be executed for the whole subtree..
    node.adjustLevel(this.level + 1)
  }

  adjustLevel(level)
  {
    this.level = level
    // todo: you have to adjust levels in whole subtree or compute the level always as distance from root
    this.children.forEach(child => {child.adjustLevel(level + 1)})
  }

  // proomise??
  getNormMd()
  {
    if (!this.normMd)
    {
      let pageMd = fs.readFileSync(this.path).toString()
      // normalize links
      this.normMd = PageNode.normaliseMdLinks(pageMd)
    }

    return this.normMd
  }

  static normaliseMdLinks(markdown)
  {
    return markdown.replace(/\[\[([^\]]+)\]\]/g, function(allPattern, link) {

      // inside of brekets link can be added as:
      // - page name only [[Calls]], [[Call-Log]];
      // - link title only [[Call Log]];
      // - link title and page name [[Call Log|Call-Log]], [[Log|Call Log]].

      // search for link title
      let linkTitle = link.replace(/\|([^\|]+)/, "")

      // search for page name
      let pageName = link.replace(/([^\|]+)\|/, "")

      if(!linkTitle){
        linkTitle = link
      }

      if (!pageName){
        pageName = link
      }

      // make sure page name has correct format
      pageName = pageName.replace(/ /g, "-")

      // convert [[<link title> | <page name>]] to [<link title>](<page name>)
      link = `[${linkTitle}](${pageName})`
      return link
    })
  }

  static shiftHeaderLevels(md, level) {
    console.log(level)
    // there is an issue - potentially you should push page headings by "level" down in the whole page
    // .. maybe easiest by some sed-like expression on the markdown page pushing headers by "level" down
    return md
  }

  static getPageIdFromFilenameOrLink(filename) {
    let base = path.basename(filename)
    if (base.substr(-3) === '.md') {
      base = base.substr(0, base.length - 3)
    }
    return base.replace(/([^a-z0-9\-_~.]+)/gi, '')
  }

}

PageNode.prototype.toString = function()
{
  return `[level: ${this.level}, text: ${this.href}, path: ${this.path}, href: ${this.href}]`
}


class Gollum2pdf
{

  constructor(wikiRootPath, options) {
    this.wikiRootPath = wikiRootPath
    this.options = options

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
    let mdFixedLevels = PageNode.shiftHeaderLevels(md, node.level)

    // todo: improve .. prepend header for the page
    let pageHeader=`<h1 id="${node.id}" style="page-break-before: always !important;">${node.text}</h1>`
    let pageHtml = marked(mdFixedLevels, {renderer: this.getPageRenderer()})

    return pageHeader.concat(pageHtml)
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
        }
        else
        {
          if (level < prev.level)
          {
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

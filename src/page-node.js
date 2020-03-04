'use strict'

const fs = require('fs-extra'),
    path = require('path'),
    marked = require('marked'),
    find = require('find')

class TocItem
{
    constructor(level, text, href) {
        this.level = level
        this.text = text
        this.href = href
    }
}

class PageNode
{
    // from markdown link function output when parsing parent MD
    constructor(href, text, path, programOpts) {
        this.href = href
        this.text = text
        this.path = path
        this.level = 0
        this.id = PageNode.getPageIdFromFilenameOrLink(this.path)
        this.programOpts = programOpts

        // for ref tracing
        this.parent = null
        this.children = []

        // heading (1st h1 in page text)
        // is set as part of exploring children, when the MD is parsed
        this.heading = null

        // aggregated during initial parsing
        this.toc = []
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

    readMd()
    {
        if (!this.md) {
            this.md = fs.readFileSync(this.path).toString()
            this.extractMdOptsFromMd()
        }

        return this.md
    }

    extractMdOptsFromMd() {
        if (!this.mdOpts) {
            this.mdOpts = {}
            // detect Gollum TOC
            const tocRegex = /\[\[_TOC_[^\]]*\]\]/gm
            this.mdOpts.toc = tocRegex.test(this.md)
        }

        return this.mdOpts
    }

    renderToc(){
        let html = `<div class="toc">
    <div class="toc-title">Table of Contents</div>
    <ul>`

        // render items
        let rendered = null
        this.toc.forEach(tocItem => {
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

    extractChildren(nodes) {
        console.log("extracting children of: " + this.toString())

        // setup once only outside this block
        let refRenderer = new marked.Renderer()
        let self = this

        // extract first heading
        refRenderer.heading = function (text, level) {
            if (!self.heading)
                self.heading = text

            // aggregate TOC here
            const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-')
            self.toc.push(new TocItem(level, text, `#${escapedText}`))
        }

        // if new min depth for linked page, create child
        // .. will be parsed as part of next recursion
        refRenderer.link = function(href, title, text) {
            // links are normalised alredy. recognise internal links:
            if (!href.match(/^https?:\/\//)) {
                let prev = nodes.get(href)
                let level = self.level + 1
                if (!prev) {
                    let mdFilePath = self.getMdFilePath(href)
                    if (mdFilePath !== "not-found") {
                        // title seems not to be the right field..
                        let x = new PageNode(href, text, mdFilePath, self.programOpts)
                        self.addChild(x)
                        nodes.set(href, x)
                        x.extractChildren(nodes)
                    }
                } else {
                    if (level < prev.level) {
                        prev.parent.removeChild(prev)
                        // levels corrected on addChild operation for whole subtree..
                        self.addChild(prev)
                    }
                }
            }
        }

        marked(PageNode.normaliseMd(this.readMd()), { renderer: refRenderer })
    }

    getMdFilePath(href) {
        // replicate gollum refs by searching for canonical name..
        let gollumPattern = href
            .replace(" ", "-")
            .replace("(","\\(")
            .replace(")", "\\)")
            .concat(".md")

        let files = find.fileSync(new RegExp(gollumPattern, 'i'), this.programOpts.wikiRootPath)
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

        let files = find.fileSync(new RegExp(gollumPattern), this.programOpts.wikiRootPath)
        if (files.length !== 1) {
            console.error("Image: Error getting path for href=" + href + ", matches: " + files)
            return "not-found"
        }

        return files[0]
    }

    static normaliseMd(markdown) {
        // remove Gollum TOC (is detected before this place)
        // normalise links
        return markdown
            .replace(/\[\[_TOC_[^\]]*\]\]/g, "")
            .replace(/\[\[([^\]]+)\]\]/g, function (allPattern, link) {

                // inside of brekets link can be added as:
                // - page name only [[Calls]], [[Call-Log]];
                // - link title only [[Call Log]];
                // - link title and page name [[Call Log|Call-Log]], [[Log|Call Log]].

                // search for link title
                let linkTitle = link.replace(/\|([^\|]+)/, "")

                // search for page name
                let pageName = link.replace(/([^\|]+)\|/, "")

                if (!linkTitle) {
                    linkTitle = link
                }

                if (!pageName) {
                    pageName = link
                }

                // make sure page name has correct format
                pageName = pageName.replace(/ /g, "-")

                // convert [[<link title> | <page name>]] to [<link title>](<page name>)
                link = `[${linkTitle}](${pageName})`
                return link
            })
    }

    static getPageIdFromFilenameOrLink(filename) {
        let base = path.basename(filename)
        if (base.substr(-3) === '.md') {
            base = base.substr(0, base.length - 3)
        }
        return base.toLowerCase().replace(/[^\w]+/g, '-')
        //return base.replace(/([^a-z0-9\-_~.]+)/gi, '')
    }

    static dfs(parent, nodeList)
    {
        nodeList.push(parent)
        parent.children.forEach(child => {PageNode.dfs(child, nodeList)})

        return nodeList
    }

}

PageNode.prototype.toString = function()
{
    return `[level: ${this.level}, text: ${this.href}, path: ${this.path}, href: ${this.href}]`
}

module.exports = PageNode

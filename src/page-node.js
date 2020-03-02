'use strict'

const fs = require('fs-extra'),
    path = require('path')

class PageNode
{
    // from markdown link function output when parsing parent MD
    constructor(href, text, path) {
        this.href = href
        this.text = text
        this.path = path
        this.level = 0
        this.id = PageNode.getPageIdFromFilenameOrLink(this.path)

        // for ref tracing
        this.parent = null
        this.children = []

        // heading (1st h1 in page text)
        // is set as part of exploring children, when the MD is parsed
        this.heading = null
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

    static getPageIdFromFilenameOrLink(filename) {
        let base = path.basename(filename)
        if (base.substr(-3) === '.md') {
            base = base.substr(0, base.length - 3)
        }
        return base.toLowerCase().replace(/[^\w]+/g, '-')
        //return base.replace(/([^a-z0-9\-_~.]+)/gi, '')
    }

}

PageNode.prototype.toString = function()
{
    return `[level: ${this.level}, text: ${this.href}, path: ${this.path}, href: ${this.href}]`
}

module.exports = PageNode

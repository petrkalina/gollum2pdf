'use strict'

const find = require('find'),
    util = require('util'),
    fs = require('fs')

class HtmlBuilder
{
  // from markdown link function output
  constructor(options) {
    this.options = options
  }

  buildCss() {
    let css = ""
    let format = '<style>%s</style>'

    let files = find.fileSync(new RegExp(".css"), this.options.cssDir)
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
    <title>${this.options.title}</title>
    ${this.buildCss()}
    ${this.buildJs()}
  </head>
  <body id="page-top" class="pdf-doc">
    <div class='covertitle'>
      <b>${this.options.title}</b>
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

module.exports = HtmlBuilder

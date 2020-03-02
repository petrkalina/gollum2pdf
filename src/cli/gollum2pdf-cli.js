#!/usr/bin/env node

"use strict"

const program = require('commander'),
    GollumConverter = require('../gollum2pdf'),
    fs = require('fs'),
    path = require('path')


class Gollum2pdfCli {

  constructor () {

    // version an be taken from package version..
    this.program = program.version(1.0)

        .usage('[options] <wiki-dir>')
        .description('Convert a gollum wiki')

        .option("-o, --output <output-dir>", "Output dir [default: './']", './')
        .option("--ref-tracing-root-page-path <md-file>", "Root Page Path to Generate using Reference Tracing")
        .option("--ref-tracing-root-page-title <title>", "TOC and Document Title for Generating using Reference Tracing")
        .option("--ref-tracing-toc-max-level <level>", "Max TOC Level")

        .option("-v --verbose", "Verbose mode")
  }

  run() {
    this.program.parse(process.argv)
    if (!this.program.args.length) {
      this.program.help()
    }

    let options = {
      outputDir: this.program.output,
      refTracingRootPagePath: this.program.refTracingRootPagePath,
      // this is better taken from the first page
      // some other params would be good for customising the front page of the manual
      refTracingRootPageTitle: this.program.refTracingRootPageTitle ? this.program.refTracingRootPageTitle : "Generated by gollum2pdf",
      refTracingTocMaxLevel: this.program.refTracingTocMaxLevel ? parseInt(this.program.refTracingTocMaxLevel) : 3
    }


    let wikiPath = this.program.args[0]
    let converter = new GollumConverter(wikiPath, options)

    // render html
    let html = converter.renderHtml()

    // .. store to file
    let htmlOutFile = path.join("./", options.outputDir, "gollum2pdf.html")
//    let htmlOutFile = "gollum2pdf.html"
    fs.writeFile(htmlOutFile, html, function(err) {
      if(err) {
        return console.log(err)
      }
      console.log("Written html to: " + htmlOutFile)
    })

    // render PDF (out file is used in pipe at the end of command..)
    // todo: process output dir and file params
    let pdfFile = path.join(options.outputDir, "gollum2pdf.pdf")
    converter.renderPdf(html, pdfFile)

  }

}

if (require.main === module) {
  new Gollum2pdfCli().run()
}

module.exports = Gollum2pdfCli

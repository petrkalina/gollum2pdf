'use strict'

const wkhtmltopdf = require('wkhtmltopdf'),
    fs = require('fs-extra')

class PdfRenderer {
    // from markdown link function output when parsing parent MD
    constructor(programOpts) {
        // todo: other options process after
        // let footer = this.converter.getOption('footer')
        // let pdfPageCount = this.converter.getOption('pdfPageCount')



        this.wkhtml2pdfOptions = {
            toc: false,
            outline: true,
            marginLeft: 10,
            marginRight: 10,
            footerLine: false,
            footerSpacing: 2.5,
            footerFontSize: 10,
            pageOffset: 0
        }

        // check id custom.css exists and if yes, load it
        let gollumDefaultCustomCss = `${programOpts.wikiRootPath}/custom.css`
        if (fs.existsSync(gollumDefaultCustomCss))
            this.wkhtml2pdfOptions.userStyleSheet = gollumDefaultCustomCss

        //if (footer) {
        //  wkhtml2pdfOptions.footerLeft = footer
        //}
        //if (pdfPageCount) {
        //  wkhtml2pdfOptions.footerRight = "[page]/[toPage]"
        //}
    }

    renderPdf(html, pdfFile)
    {
        let self = this
        return new Promise(function (resolve, reject) {
            wkhtmltopdf(html, self.wkhtml2pdfOptions)
                .on('end', function () {
                    console.info('pdf conversion finished: %s', pdfFile)
                    resolve(pdfFile)
                })
                .on('error', reject)
                .pipe(fs.createWriteStream(pdfFile))
        })
    }
}

module.exports = PdfRenderer

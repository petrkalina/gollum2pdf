'use strict'

const wkhtmltopdf = require('wkhtmltopdf'),
    fs = require('fs-extra')

class PdfRenderer {
    // from markdown link function output when parsing parent MD
    constructor(wkhtml2pdfOptions) {
        this.wkhtml2pdfOptions = wkhtml2pdfOptions
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

'use strict'

const wkhtmltopdf = require('wkhtmltopdf'),
    fs = require('fs-extra')

class PdfRenderer {
    // from markdown link function output when parsing parent MD
    constructor(programOpts) {
        // todo: other options process after
        // let footer = this.converter.getOption('footer')
        // let pdfPageCount = this.converter.getOption('pdfPageCount')


        this.prorgamOpts = programOpts

        this.wkhtml2pdfOptions = {
            toc: false,
            outline: true,
            marginLeft: 10,
            marginRight: 10,
            footerLine: false,
            footerSpacing: 2.5,
            footerFontSize: 10,
            pageOffset: 0,
            footerHtml: `${programOpts.assetsDir}/footer.html`,
            headerHtml: `${programOpts.assetsDir}/header.html`

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
        let pdfTmpFile = "/tmp/wiki2pfd-no-cover.pdf"
        return new Promise(function (resolve, reject) {
            wkhtmltopdf(html, self.wkhtml2pdfOptions)
                .on('end', function () {
                    console.info('pdf conversion finished: %s', pdfTmpFile)

                    self.prependPdfCover(pdfTmpFile)
                    console.info('prepended cover to %s: %s', pdfTmpFile, pdfFile)

                    resolve(pdfTmpFile)
                })
                .on('error', reject)
                .pipe(fs.createWriteStream(pdfTmpFile))
        })
    }

    prependPdfCover(intermediatePdfFile)
    {
        let pdfFile = this.prorgamOpts.pdfFile
        let pdfCover = this.prorgamOpts.pdfCover

        const gsJoinPdf = `gs -q -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOutputFile=${pdfFile} -dPrinted=false ${pdfCover} ${intermediatePdfFile}`

        const { exec } = require('child_process')
        exec(gsJoinPdf, (err, stdout, stderr) => {
            if (err) {
                console.error(err)
                return
            }

            console.log(`stdout: ${stdout}`)
            console.log(`stderr: ${stderr}`)
        })
    }
}

module.exports = PdfRenderer

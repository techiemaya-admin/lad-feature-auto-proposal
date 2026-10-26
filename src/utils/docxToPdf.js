const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const url = require('url');
const tmp = require('tmp');

const SOFFICE_PATH = process.env.SOFFICE_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'
    : 'soffice');

/**
 * Converts a docx Buffer into a PDF Buffer using LibreOffice headless.
 * Handles Windows stderr false positives (e.g. benign XML parser startup warning).
 */
function convertDocxBufferToPdf(documentBuffer) {
  return new Promise((resolve, reject) => {
    const tempDir = tmp.dirSync({ prefix: 'libreofficeConvert_', unsafeCleanup: true });
    const installDir = tmp.dirSync({ prefix: 'soffice_', unsafeCleanup: true });
    const inputPath = path.join(tempDir.name, 'document.docx');
    const outputPath = path.join(tempDir.name, 'document.pdf');

    fs.writeFile(inputPath, documentBuffer, (writeErr) => {
      if (writeErr) {
        try {
          tempDir.removeCallback();
          installDir.removeCallback();
        } catch (_) {}
        return reject(writeErr);
      }

      const args = [
        `-env:UserInstallation=${url.pathToFileURL(installDir.name)}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        tempDir.name,
        inputPath
      ];

      execFile(SOFFICE_PATH, args, (execErr, stdout, stderr) => {
        if (execErr) {
          try {
            tempDir.removeCallback();
            installDir.removeCallback();
          } catch (_) {}
          return reject(execErr);
        }

        // LibreOffice on Windows emits benign XML parser startup warnings to stderr:
        // "Entity: line 1: parser error : Document is empty"
        // Verify output file on disk directly instead of tripping on stderr string
        fs.readFile(outputPath, (readErr, pdfBuffer) => {
          try {
            tempDir.removeCallback();
            installDir.removeCallback();
          } catch (_) {}

          if (readErr) {
            return reject(readErr || new Error(stderr || 'PDF conversion failed'));
          }
          resolve(pdfBuffer);
        });
      });
    });
  });
}

module.exports = { convertDocxBufferToPdf };

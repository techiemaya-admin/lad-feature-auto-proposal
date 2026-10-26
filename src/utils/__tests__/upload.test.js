const { documentUpload, imageUpload, safeFileName } = require('../upload');


describe('upload helpers', () => {
  describe('safeFileName', () => {
    it.each([
      ['../../etc/passwd', 'passwd'],
      ['report final (v2).docx', 'report_final__v2_.docx'],
      ['..\\..\\windows\\system.ini', '_.._windows_system.ini'],
      ['.htaccess', 'htaccess'],
      ['', 'file'],
      [undefined, 'file'],
    ])('sanitises %p to %p', (input, expected) => {
      expect(safeFileName(input)).toBe(expected);
    });

    it('caps length at 100 characters', () => {
      expect(safeFileName('a'.repeat(300) + '.docx')).toHaveLength(100);
    });
  });
});

describe('upload routes enforce type and size limits', () => {
  const express = require('express');
  const http = require('http');

  function makeApp(uploader, field) {
    const app = express();
    app.post('/up', uploader.single(field), (req, res) => res.json({ ok: true, name: req.file && req.file.originalname }));
    app.use((err, req, res, next) => {
      const status = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
      res.status(status).json({ error: err.message });
    });
    return app;
  }

  function postFile(app, field, filename, contentType, size) {
    return new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const boundary = '----testboundary';
        const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
        const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([head, Buffer.alloc(size, 1), tail]);
        const req = http.request({
          port: server.address().port, method: 'POST', path: '/up',
          headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': body.length },
        }, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: data }); });
        });
        req.on('error', (e) => { server.close(); reject(e); });
        req.end(body);
      });
    });
  }

  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  it('accepts a .docx template', async () => {
    const res = await postFile(makeApp(documentUpload, 'file'), 'file', 'quote.docx', DOCX, 1024);
    expect(res.status).toBe(200);
  });

  it('rejects non-.docx templates', async () => {
    const res = await postFile(makeApp(documentUpload, 'file'), 'file', 'shell.html', 'text/html', 1024);
    expect(res.status).toBe(400);
  });

  it('rejects templates over 10 MB', async () => {
    const res = await postFile(makeApp(documentUpload, 'file'), 'file', 'big.docx', DOCX, 10 * 1024 * 1024 + 1);
    expect(res.status).toBe(400);
  });

  it('accepts a PNG logo and rejects SVG', async () => {
    expect((await postFile(makeApp(imageUpload, 'logo'), 'logo', 'logo.png', 'image/png', 1024)).status).toBe(200);
    expect((await postFile(makeApp(imageUpload, 'logo'), 'logo', 'logo.svg', 'image/svg+xml', 1024)).status).toBe(400);
  });

  it('rejects logos over 2 MB', async () => {
    const res = await postFile(makeApp(imageUpload, 'logo'), 'logo', 'logo.png', 'image/png', 2 * 1024 * 1024 + 1);
    expect(res.status).toBe(400);
  });
});

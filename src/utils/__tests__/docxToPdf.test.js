const { convertDocxBufferToPdf } = require('../docxToPdf');
const child_process = require('child_process');
const fs = require('fs');
const tmp = require('tmp');

jest.mock('child_process');
jest.mock('tmp');

describe('docxToPdf utility', () => {
  let writeFileSpy;
  let readFileSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    tmp.dirSync.mockImplementation(({ prefix }) => ({
      name: `C:\\mock\\temp\\${prefix}`,
      removeCallback: jest.fn(),
    }));
    writeFileSpy = jest.spyOn(fs, 'writeFile');
    readFileSpy = jest.spyOn(fs, 'readFile');
  });

  afterEach(() => {
    writeFileSpy.mockRestore();
    readFileSpy.mockRestore();
  });

  it('resolves with PDF buffer when soffice succeeds even with benign stderr warnings', async () => {
    const mockInputBuffer = Buffer.from('mock docx content');
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf content');

    writeFileSpy.mockImplementation((filePath, data, cb) => cb(null));
    child_process.execFile.mockImplementation((cmd, args, cb) => {
      // Simulate Windows LibreOffice benign stderr warning with exit 0 (no execErr)
      cb(null, '', 'Entity: line 1: parser error : Document is empty');
    });
    readFileSpy.mockImplementation((filePath, cb) => cb(null, mockPdfBuffer));

    const result = await convertDocxBufferToPdf(mockInputBuffer);

    expect(result).toEqual(mockPdfBuffer);
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    expect(child_process.execFile).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects if fs.writeFile encounters an I/O error', async () => {
    const mockInputBuffer = Buffer.from('mock docx');
    writeFileSpy.mockImplementation((filePath, data, cb) => cb(new Error('Disk write error')));

    await expect(convertDocxBufferToPdf(mockInputBuffer)).rejects.toThrow('Disk write error');
  });

  it('rejects if child_process.execFile fails with an execution error', async () => {
    const mockInputBuffer = Buffer.from('mock docx');
    writeFileSpy.mockImplementation((filePath, data, cb) => cb(null));
    child_process.execFile.mockImplementation((cmd, args, cb) => {
      cb(new Error('Command failed: soffice exit code 1'), '', 'Fatal error');
    });

    await expect(convertDocxBufferToPdf(mockInputBuffer)).rejects.toThrow(
      'Command failed: soffice exit code 1'
    );
  });

  it('rejects if output PDF file could not be read after execution', async () => {
    const mockInputBuffer = Buffer.from('mock docx');
    writeFileSpy.mockImplementation((filePath, data, cb) => cb(null));
    child_process.execFile.mockImplementation((cmd, args, cb) => {
      cb(null, '', 'Some warning');
    });
    readFileSpy.mockImplementation((filePath, cb) => cb(new Error('ENOENT: no such file')));

    await expect(convertDocxBufferToPdf(mockInputBuffer)).rejects.toThrow('ENOENT: no such file');
  });
});

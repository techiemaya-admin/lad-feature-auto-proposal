process.env.GCS_BUCKET = process.env.GCS_BUCKET || 'test-bucket';

const mockDownload = jest.fn();
jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue({ file: jest.fn(() => ({ download: mockDownload })) }),
  })),
}));
jest.mock('libreoffice-convert', () => ({ convert: jest.fn() }));
jest.mock('../../repositories/quotation-template-metadata.repository');

const repository = require('../../repositories/quotation-template-metadata.repository');
const service = require('../quotation-template.service');
const controller = require('../../controllers/quotation-template.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), contentType: jest.fn(), send: jest.fn() };
}

describe('Quotation template tenant scoping', () => {
  beforeEach(() => jest.clearAllMocks());

  it('preview looks the template up with the caller\'s tenant and 404s for another tenant\'s template', async () => {
    repository.findById.mockResolvedValue(null);
    const res = mockRes();

    await service.getVisualPreview({ params: { id: 'tpl-of-tenant-b' }, tenantId: 'tenant-a' }, res);

    expect(repository.findById).toHaveBeenCalledWith('tpl-of-tenant-b', 'tenant-a');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('delete passes the caller\'s tenant and 404s when nothing of theirs matched', async () => {
    repository.deleteTemplate.mockResolvedValue(null);
    const res = mockRes();

    await controller.remove({ params: { id: 'tpl-of-tenant-b' }, tenantId: 'tenant-a' }, res);

    expect(repository.deleteTemplate).toHaveBeenCalledWith('tpl-of-tenant-b', 'tenant-a');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('delete succeeds for the caller\'s own template', async () => {
    repository.deleteTemplate.mockResolvedValue({ id: 'tpl-1' });
    const res = mockRes();

    await controller.remove({ params: { id: 'tpl-1' }, tenantId: 'tenant-a' }, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

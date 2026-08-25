const controller = require('../tenant-profile.controller');
const repository = require('../../repositories/tenant-profile.repository');
const { uploadBufferToGCS } = require('../../../../utils/gcsUploader');

jest.mock('../../repositories/tenant-profile.repository');
jest.mock('../../../../utils/gcsUploader');

describe('TenantProfileController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { tenantId: 'tenant-123' },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('getProfile', () => {
    it('returns tenant profile with 200 OK', async () => {
      const mockProfile = { id: 'p-1', tenant_id: 'tenant-123', official_email: 'info@events.com' };
      repository.findByTenantId.mockResolvedValue(mockProfile);

      await controller.getProfile(req, res);

      expect(repository.findByTenantId).toHaveBeenCalledWith('tenant-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockProfile);
    });

    it('returns 500 when repository throws error', async () => {
      repository.findByTenantId.mockRejectedValue(new Error('DB Error'));

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to retrieve tenant profile',
      });
    });
  });

  describe('updateField', () => {
    it('accepts fieldName and fieldValue schema format', async () => {
      req.body = { fieldName: 'tagline', fieldValue: 'Premium Events' };
      repository.updateField.mockResolvedValue({ tagline: 'Premium Events' });

      await controller.updateField(req, res);

      expect(repository.updateField).toHaveBeenCalledWith('tenant-123', 'tagline', 'Premium Events');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'tagline updated successfully',
        data: { tagline: 'Premium Events' },
      });
    });

    it('accepts standard field and value schema format', async () => {
      req.body = { field: 'website', value: 'https://example.com' };
      repository.updateField.mockResolvedValue({ website: 'https://example.com' });

      await controller.updateField(req, res);

      expect(repository.updateField).toHaveBeenCalledWith('tenant-123', 'website', 'https://example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'website updated successfully',
        data: { website: 'https://example.com' },
      });
    });

    it('returns 400 when neither field nor fieldName is provided', async () => {
      req.body = { value: 'some-value' };

      await controller.updateField(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Field name is required' });
      expect(repository.updateField).not.toHaveBeenCalled();
    });

    it('returns 400 when repository update throws error', async () => {
      req.body = { field: 'tagline', value: 'New Tag' };
      repository.updateField.mockRejectedValue(new Error('Update failed'));

      await controller.updateField(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Update failed' });
    });
  });

  describe('getLogoPreview', () => {
    it('returns logo URL with 200 OK when present', async () => {
      repository.findByTenantId.mockResolvedValue({
        company_logo_url: 'https://cdn.example.com/logo.png',
      });

      await controller.getLogoPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        logoUrl: 'https://cdn.example.com/logo.png',
      });
    });

    it('returns 404 when profile or company_logo_url is missing', async () => {
      repository.findByTenantId.mockResolvedValue(null);

      await controller.getLogoPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No logo found for this tenant' });
    });

    it('returns 500 when repository fails', async () => {
      repository.findByTenantId.mockRejectedValue(new Error('DB Error'));

      await controller.getLogoPreview(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB Error' });
    });
  });

  describe('uploadLogo', () => {
    it('returns 400 when req.file is missing', async () => {
      req.file = undefined;

      await controller.uploadLogo(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No image file provided' });
    });

    it('uploads file buffer to GCS and updates company_logo_url on profile', async () => {
      req.file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
      };
      uploadBufferToGCS.mockResolvedValue('https://storage.googleapis.com/bucket/logos/tenant-123/12345_logo.png');
      repository.updateField.mockResolvedValue({
        company_logo_url: 'https://storage.googleapis.com/bucket/logos/tenant-123/12345_logo.png',
      });

      await controller.uploadLogo(req, res);

      expect(uploadBufferToGCS).toHaveBeenCalledWith(
        req.file.buffer,
        expect.stringMatching(/^logos\/tenant-123\/\d+_logo\.png$/),
        'image/png'
      );
      expect(repository.updateField).toHaveBeenCalledWith(
        'tenant-123',
        'company_logo_url',
        'https://storage.googleapis.com/bucket/logos/tenant-123/12345_logo.png'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Logo uploaded successfully',
        logoUrl: 'https://storage.googleapis.com/bucket/logos/tenant-123/12345_logo.png',
      }));
    });

    it('returns 500 when upload fails', async () => {
      req.file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
      };
      uploadBufferToGCS.mockRejectedValue(new Error('GCS Upload Failed'));

      await controller.uploadLogo(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'GCS Upload Failed' });
    });
  });
});

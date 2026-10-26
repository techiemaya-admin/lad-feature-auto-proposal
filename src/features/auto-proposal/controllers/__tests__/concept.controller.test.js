const conceptController = require('../concept.controller');
const conceptService = require('../../services/concept.service');

jest.mock('../../services/concept.service');

describe('ConceptController', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      tenantId: 'authenticated-tenant-123',
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('create', () => {
    it('uses authenticated req.tenantId instead of client-provided body.tenant_id', async () => {
      req.body = {
        tenant_id: 'spoofed-tenant-456',
        name: 'Test Concept',
        code: 'TC-01',
        description: 'A test concept',
      };
      const mockCreated = {
        id: 'concept-1',
        tenant_id: 'authenticated-tenant-123',
        name: 'Test Concept',
        code: 'TC-01',
        description: 'A test concept',
      };
      conceptService.createConcept.mockResolvedValue(mockCreated);

      await conceptController.create(req, res, next);

      expect(conceptService.createConcept).toHaveBeenCalledWith(
        'authenticated-tenant-123',
        expect.objectContaining({ name: 'Test Concept' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('passes error to next on failure', async () => {
      const error = new Error('Database error');
      conceptService.createConcept.mockRejectedValue(error);

      await conceptController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('list', () => {
    it('uses authenticated req.tenantId instead of req.params.tenant_id', async () => {
      req.params = { tenant_id: 'spoofed-tenant-456' };
      const mockList = [{ id: 'c-1', name: 'Concept 1' }];
      conceptService.listConcepts.mockResolvedValue(mockList);

      await conceptController.list(req, res, next);

      expect(conceptService.listConcepts).toHaveBeenCalledWith('authenticated-tenant-123');
      expect(res.json).toHaveBeenCalledWith(mockList);
    });

    it('passes error to next on failure', async () => {
      const error = new Error('Fetch failed');
      conceptService.listConcepts.mockRejectedValue(error);

      await conceptController.list(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('update', () => {
    it('uses authenticated req.tenantId instead of body.tenant_id', async () => {
      req.params = { id: 'concept-1' };
      req.body = {
        tenant_id: 'spoofed-tenant-456',
        name: 'Updated Concept',
      };
      const mockUpdated = { id: 'concept-1', tenant_id: 'authenticated-tenant-123', name: 'Updated Concept' };
      conceptService.updateConcept.mockResolvedValue(mockUpdated);

      await conceptController.update(req, res, next);

      expect(conceptService.updateConcept).toHaveBeenCalledWith(
        'authenticated-tenant-123',
        'concept-1',
        req.body
      );
      expect(res.json).toHaveBeenCalled();
    });

    it('passes error to next on failure', async () => {
      req.params = { id: 'concept-1' };
      const error = new Error('Update failed');
      conceptService.updateConcept.mockRejectedValue(error);

      await conceptController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('remove', () => {
    it('passes req.tenantId and id to conceptService.deleteConcept', async () => {
      req.params = { id: 'concept-1' };
      conceptService.deleteConcept.mockResolvedValue({ id: 'concept-1' });

      await conceptController.remove(req, res, next);

      expect(conceptService.deleteConcept).toHaveBeenCalledWith('authenticated-tenant-123', 'concept-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('passes error to next on failure', async () => {
      req.params = { id: 'concept-1' };
      const error = new Error('Delete failed');
      conceptService.deleteConcept.mockRejectedValue(error);

      await conceptController.remove(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

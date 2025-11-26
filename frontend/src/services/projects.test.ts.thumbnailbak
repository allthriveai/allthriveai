import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteProjectRedirect } from './projects';
import { api } from './api';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    delete: vi.fn(),
  },
}));

describe('projects service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteProjectRedirect', () => {
    it('should make the correct API call with project and redirect IDs', async () => {
      const projectId = 42;
      const redirectId = 123;

      vi.mocked(api.delete).mockResolvedValue({ data: null });

      await deleteProjectRedirect(projectId, redirectId);

      expect(api.delete).toHaveBeenCalledWith(`/me/projects/${projectId}/redirects/${redirectId}/`);
      expect(api.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle successful deletion', async () => {
      const projectId = 1;
      const redirectId = 2;

      vi.mocked(api.delete).mockResolvedValue({ data: null });

      await expect(deleteProjectRedirect(projectId, redirectId)).resolves.toBeUndefined();
    });

    it('should propagate errors from the API', async () => {
      const projectId = 1;
      const redirectId = 2;
      const error = new Error('Network error');

      vi.mocked(api.delete).mockRejectedValue(error);

      await expect(deleteProjectRedirect(projectId, redirectId)).rejects.toThrow('Network error');
    });

    it('should construct the correct endpoint URL with different IDs', async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: null });

      await deleteProjectRedirect(999, 777);

      expect(api.delete).toHaveBeenCalledWith('/me/projects/999/redirects/777/');
    });

    it('should handle 404 errors when redirect does not exist', async () => {
      const projectId = 1;
      const redirectId = 999;
      const error = { response: { status: 404, data: { detail: 'Not found' } } };

      vi.mocked(api.delete).mockRejectedValue(error);

      await expect(deleteProjectRedirect(projectId, redirectId)).rejects.toEqual(error);
    });

    it('should handle 403 errors when user lacks permission', async () => {
      const projectId = 1;
      const redirectId = 2;
      const error = { response: { status: 403, data: { detail: 'Permission denied' } } };

      vi.mocked(api.delete).mockRejectedValue(error);

      await expect(deleteProjectRedirect(projectId, redirectId)).rejects.toEqual(error);
    });
  });
});

import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ProjectEditorPage from './ProjectEditorPage';
import * as projectsService from '@/services/projects';
import type { Project } from '@/types/models';

// Mock the services
vi.mock('@/services/projects', () => ({
  listProjects: vi.fn(),
  updateProject: vi.fn(),
}));

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ username: 'testuser', projectSlug: 'test-project' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock the DashboardLayout
vi.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the RichTextEditor
vi.mock('@/components/editor/RichTextEditor', () => ({
  RichTextEditor: ({ onChange, placeholder }: any) => (
    <textarea
      data-testid="rich-text-editor"
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock upload service
vi.mock('@/services/upload', () => ({
  uploadImage: vi.fn(),
}));

const mockProject: Project = {
  id: 1,
  username: 'testuser',
  title: 'Test Project',
  slug: 'test-project',
  description: 'Test description',
  type: 'other',
  isShowcase: true,
  isArchived: false,
  isPublished: false,
  publishedAt: null,
  thumbnailUrl: null,
  content: {
    blocks: [
      {
        type: 'text',
        content: 'Test Project',
        style: 'heading',
      },
      {
        type: 'text',
        content: 'This is a test paragraph.',
        style: 'body',
      },
    ],
  },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ProjectEditorPage - Autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup default mock implementations
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProject);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const renderEditor = () => {
    return render(
      <BrowserRouter>
        <ProjectEditorPage />
      </BrowserRouter>
    );
  };

  it('should autosave after 2 seconds of inactivity', async () => {
    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear the mock calls from initial load
    vi.mocked(projectsService.updateProject).mockClear();

    // Find the title input and change it
    const titleInput = await screen.findByDisplayValue('Test Project');

    await act(async () => {
      titleInput.focus();
      titleInput.setAttribute('value', 'Updated Project Title');
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Should not save immediately
    expect(projectsService.updateProject).not.toHaveBeenCalled();

    // Fast-forward time by 1 second (not enough to trigger autosave)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(projectsService.updateProject).not.toHaveBeenCalled();

    // Fast-forward another 1 second (total 2 seconds - should trigger autosave)
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Wait for the autosave to complete
    await waitFor(() => {
      expect(projectsService.updateProject).toHaveBeenCalledTimes(1);
    });
  });

  it('should debounce multiple rapid changes', async () => {
    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear the mock calls
    vi.mocked(projectsService.updateProject).mockClear();

    // Find the title input
    const titleInput = await screen.findByDisplayValue('Test Project');

    // Make multiple rapid changes
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        titleInput.setAttribute('value', `Update ${i}`);
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        // Advance time by 500ms between changes
        vi.advanceTimersByTime(500);
      });
    }

    // Should still not have saved (debouncing)
    expect(projectsService.updateProject).not.toHaveBeenCalled();

    // Fast-forward past the debounce period
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should only save once despite multiple changes
    await waitFor(() => {
      expect(projectsService.updateProject).toHaveBeenCalledTimes(1);
    });
  });

  it('should display "Saving..." indicator during save', async () => {
    // Make updateProject take some time to resolve
    vi.mocked(projectsService.updateProject).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockProject), 100))
    );

    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(screen.queryByText('Loading editor...')).not.toBeInTheDocument();
    });

    // Clear mocks
    vi.mocked(projectsService.updateProject).mockClear();

    // Make a change
    const titleInput = await screen.findByDisplayValue('Test Project');
    await act(async () => {
      titleInput.setAttribute('value', 'New Title');
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Fast-forward to trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should show "Saving..." indicator
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    // Wait for save to complete
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('should update "last saved" timestamp after autosave', async () => {
    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear mocks
    vi.mocked(projectsService.updateProject).mockClear();

    // Make a change
    const titleInput = await screen.findByDisplayValue('Test Project');
    await act(async () => {
      titleInput.setAttribute('value', 'Changed Title');
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for save to complete and timestamp to update
    await waitFor(() => {
      expect(projectsService.updateProject).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      // Should show "Saved" with timestamp
      const savedText = screen.getByText(/Saved \d+:\d+:\d+/);
      expect(savedText).toBeInTheDocument();
    });
  });

  it('should not trigger autosave if no changes were made', async () => {
    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear mocks
    vi.mocked(projectsService.updateProject).mockClear();

    // Fast-forward time without making any changes
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should not have called updateProject
    expect(projectsService.updateProject).not.toHaveBeenCalled();
  });

  it('should handle autosave errors silently', async () => {
    // Mock console.error to verify it's called
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make updateProject reject
    vi.mocked(projectsService.updateProject).mockRejectedValue(
      new Error('Network error')
    );

    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear mocks
    vi.mocked(projectsService.updateProject).mockClear();

    // Make a change
    const titleInput = await screen.findByDisplayValue('Test Project');
    await act(async () => {
      titleInput.setAttribute('value', 'New Title');
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for error to be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save:',
        expect.any(Error)
      );
    });

    // Should not show alert (silent failure for autosave)
    expect(global.alert).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should include updated content in autosave payload', async () => {
    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Clear mocks
    vi.mocked(projectsService.updateProject).mockClear();

    // Make a change to the title
    const titleInput = await screen.findByDisplayValue('Test Project');
    await act(async () => {
      titleInput.setAttribute('value', 'Updated Title');
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Trigger autosave
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify the update was called with correct data
    await waitFor(() => {
      expect(projectsService.updateProject).toHaveBeenCalledWith(
        mockProject.id,
        expect.objectContaining({
          title: expect.any(String),
          content: expect.objectContaining({
            blocks: expect.any(Array),
          }),
        })
      );
    });
  });
});

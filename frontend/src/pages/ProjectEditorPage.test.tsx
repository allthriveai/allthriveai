import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ProjectEditorPage from './ProjectEditorPage';
import * as projectsService from '@/services/projects';
import type { Project } from '@/types/models';

// Mock the services
vi.mock('@/services/projects', () => ({
  listProjects: vi.fn(),
  updateProject: vi.fn(),
  deleteProjectRedirect: vi.fn(),
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
  uploadFile: vi.fn(),
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, username: 'testuser' },
  }),
}));

// Mock ToolSelector component
vi.mock('@/components/projects/ToolSelector', () => ({
  ToolSelector: ({ value, onChange }: any) => (
    <div data-testid="tool-selector">
      <button onClick={() => onChange([1, 2])}>Select Tools</button>
    </div>
  ),
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

describe('ProjectEditorPage - Redirect Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProjectWithRedirects: Project = {
    ...mockProject,
    redirects: [
      {
        id: 1,
        oldSlug: 'old-test-project',
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 2,
        oldSlug: 'another-old-slug',
        createdAt: '2025-01-02T00:00:00Z',
      },
    ],
  };

  const renderEditor = () => {
    return render(
      <BrowserRouter>
        <ProjectEditorPage />
      </BrowserRouter>
    );
  };

  it('should display active redirects when present', async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProjectWithRedirects]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProjectWithRedirects);

    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    // Wait for sidebar to open and check for redirects section
    await waitFor(() => {
      expect(screen.getByText('Active Redirects')).toBeInTheDocument();
    });

    // Verify redirects are displayed
    expect(screen.getByText('/testuser/old-test-project')).toBeInTheDocument();
    expect(screen.getByText('/testuser/another-old-slug')).toBeInTheDocument();
  });

  it('should call deleteProjectRedirect when delete button is clicked for a redirect', async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProjectWithRedirects]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProjectWithRedirects);
    vi.mocked(projectsService.deleteProjectRedirect).mockResolvedValue();

    // Mock window.confirm to auto-accept
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderEditor();

    // Wait for project to load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    // Wait for redirects to be visible
    await waitFor(() => {
      expect(screen.getByText('Active Redirects')).toBeInTheDocument();
    });

    // Find and click the delete button for the first redirect
    const deleteButtons = screen.getAllByLabelText('Delete redirect');
    expect(deleteButtons.length).toBeGreaterThan(0);

    fireEvent.click(deleteButtons[0]);

    // Verify confirmation dialog was shown
    expect(confirmSpy).toHaveBeenCalled();

    // Verify deleteProjectRedirect was called with correct arguments
    await waitFor(() => {
      expect(projectsService.deleteProjectRedirect).toHaveBeenCalledWith(
        mockProjectWithRedirects.id,
        mockProjectWithRedirects.redirects![0].id
      );
    });

    confirmSpy.mockRestore();
  });

  it('should refresh project data after successful redirect deletion', async () => {
    const projectWithoutRedirect: Project = {
      ...mockProjectWithRedirects,
      redirects: [
        {
          id: 2,
          oldSlug: 'another-old-slug',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ],
    };

    vi.mocked(projectsService.listProjects)
      .mockResolvedValueOnce([mockProjectWithRedirects])
      .mockResolvedValueOnce([projectWithoutRedirect]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProjectWithRedirects);
    vi.mocked(projectsService.deleteProjectRedirect).mockResolvedValue();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderEditor();

    // Wait for initial load
    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalledTimes(1);
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Active Redirects')).toBeInTheDocument();
    });

    // Verify both redirects are initially shown
    expect(screen.getByText('/testuser/old-test-project')).toBeInTheDocument();
    expect(screen.getByText('/testuser/another-old-slug')).toBeInTheDocument();

    // Delete the first redirect
    const deleteButtons = screen.getAllByLabelText('Delete redirect');
    fireEvent.click(deleteButtons[0]);

    // Wait for deletion to complete and project to refresh
    await waitFor(() => {
      expect(projectsService.deleteProjectRedirect).toHaveBeenCalled();
      expect(projectsService.listProjects).toHaveBeenCalledTimes(2);
    });

    // Verify the deleted redirect is no longer shown
    await waitFor(() => {
      expect(screen.queryByText('/testuser/old-test-project')).not.toBeInTheDocument();
      expect(screen.getByText('/testuser/another-old-slug')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('should not delete redirect when user cancels confirmation', async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProjectWithRedirects]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProjectWithRedirects);
    vi.mocked(projectsService.deleteProjectRedirect).mockResolvedValue();

    // Mock window.confirm to return false (cancel)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderEditor();

    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Active Redirects')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByLabelText('Delete redirect');
    fireEvent.click(deleteButtons[0]);

    // Verify confirmation was shown but delete was not called
    expect(confirmSpy).toHaveBeenCalled();
    expect(projectsService.deleteProjectRedirect).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('should handle redirect deletion error gracefully', async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProjectWithRedirects]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProjectWithRedirects);
    vi.mocked(projectsService.deleteProjectRedirect).mockRejectedValue(
      new Error('Network error')
    );

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderEditor();

    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText('Active Redirects')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByLabelText('Delete redirect');
    fireEvent.click(deleteButtons[0]);

    // Wait for error handling
    await waitFor(() => {
      expect(projectsService.deleteProjectRedirect).toHaveBeenCalled();
    });

    // Verify error was logged and alert was shown
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to delete redirect:',
        expect.any(Error)
      );
      expect(alertSpy).toHaveBeenCalledWith('Failed to delete redirect. Please try again.');
    });

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should not display redirects section when project has no redirects', async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue([mockProject]);
    vi.mocked(projectsService.updateProject).mockResolvedValue(mockProject);

    renderEditor();

    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    // Open settings sidebar
    const settingsButton = screen.getByTitle('Project settings');
    fireEvent.click(settingsButton);

    // Wait for sidebar to open
    await waitFor(() => {
      expect(screen.getByText('Project Settings')).toBeInTheDocument();
    });

    // Verify redirects section is not shown
    expect(screen.queryByText('Active Redirects')).not.toBeInTheDocument();
  });
});

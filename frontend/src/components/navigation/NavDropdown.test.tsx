import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NavDropdown } from './NavDropdown';
import type { MenuSection } from './menuData';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useTheme hook
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
}));

// Mock FontAwesome
vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: any) => <span data-testid="fa-icon">{icon?.iconName || 'icon'}</span>,
}));

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: (props: any) => <svg data-testid="chevron-down" {...props}>chevron</svg>,
}));

describe('NavDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderNavDropdown = (section: MenuSection, label = 'Test Label') => {
    return render(
      <BrowserRouter>
        <NavDropdown label={label} section={section} />
      </BrowserRouter>
    );
  };

  describe('Item onClick handler behavior', () => {
    it('should call item onClick handler when item with subItems is clicked', async () => {
      const itemOnClick = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Parent Item',
            onClick: itemOnClick,
            subItems: [
              { label: 'Sub Item 1', path: '/sub1' },
              { label: 'Sub Item 2', path: '/sub2' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown by hovering
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Parent Item')).toBeInTheDocument();
      });

      // Click the parent item
      const parentItem = screen.getByText('Parent Item');
      fireEvent.click(parentItem);

      // Should call onClick handler
      expect(itemOnClick).toHaveBeenCalledTimes(1);
    });

    it('should toggle sub-items when parent item is clicked', async () => {
      const itemOnClick = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Parent Item',
            onClick: itemOnClick,
            subItems: [
              { label: 'Sub Item 1', path: '/sub1' },
              { label: 'Sub Item 2', path: '/sub2' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Parent Item')).toBeInTheDocument();
      });

      // Sub-items should not be visible initially
      expect(screen.queryByText('Sub Item 1')).not.toBeInTheDocument();

      // Click to expand
      const parentItem = screen.getByText('Parent Item');
      fireEvent.click(parentItem);

      await waitFor(() => {
        expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
        expect(screen.getByText('Sub Item 2')).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(parentItem);

      await waitFor(() => {
        expect(screen.queryByText('Sub Item 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Sub Item 2')).not.toBeInTheDocument();
      });
    });

    it('should call onClick handler AND toggle sub-items in a single click', async () => {
      const itemOnClick = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Parent Item',
            onClick: itemOnClick,
            subItems: [
              { label: 'Sub Item 1', path: '/sub1' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Parent Item')).toBeInTheDocument();
      });

      // Click the parent item once
      const parentItem = screen.getByText('Parent Item');
      fireEvent.click(parentItem);

      // Both onClick should be called AND sub-items should be visible
      expect(itemOnClick).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
      });
    });

    it('should handle multiple items with subItems independently', async () => {
      const onClick1 = vi.fn();
      const onClick2 = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Parent Item 1',
            onClick: onClick1,
            subItems: [
              { label: 'Sub Item 1A', path: '/sub1a' },
            ],
          },
          {
            label: 'Parent Item 2',
            onClick: onClick2,
            subItems: [
              { label: 'Sub Item 2A', path: '/sub2a' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Parent Item 1')).toBeInTheDocument();
        expect(screen.getByText('Parent Item 2')).toBeInTheDocument();
      });

      // Click first parent item
      fireEvent.click(screen.getByText('Parent Item 1'));

      expect(onClick1).toHaveBeenCalledTimes(1);
      expect(onClick2).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText('Sub Item 1A')).toBeInTheDocument();
      });

      // Click second parent item
      fireEvent.click(screen.getByText('Parent Item 2'));

      expect(onClick2).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByText('Sub Item 2A')).toBeInTheDocument();
      });

      // Both sub-menus should be open
      expect(screen.getByText('Sub Item 1A')).toBeInTheDocument();
      expect(screen.getByText('Sub Item 2A')).toBeInTheDocument();
    });

    it('should not call onClick when item has no onClick handler', async () => {
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Parent Item',
            subItems: [
              { label: 'Sub Item 1', path: '/sub1' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Parent Item')).toBeInTheDocument();
      });

      // Click should only toggle sub-items, not throw error
      const parentItem = screen.getByText('Parent Item');
      expect(() => fireEvent.click(parentItem)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Sub Item 1')).toBeInTheDocument();
      });
    });

    it('should prioritize onClick over path when both are present', async () => {
      const itemOnClick = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Item with Both',
            onClick: itemOnClick,
            path: '/some-path',
            subItems: [
              { label: 'Sub Item 1', path: '/sub1' },
            ],
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Item with Both')).toBeInTheDocument();
      });

      // Click the item
      fireEvent.click(screen.getByText('Item with Both'));

      // Should call onClick, not navigate
      expect(itemOnClick).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Regular item behavior (no subItems)', () => {
    it('should call item onClick handler for regular items', async () => {
      const itemOnClick = vi.fn();
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Regular Item',
            onClick: itemOnClick,
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Regular Item')).toBeInTheDocument();
      });

      // Click the item
      fireEvent.click(screen.getByText('Regular Item'));

      expect(itemOnClick).toHaveBeenCalledTimes(1);
    });

    it('should navigate to path for regular items without onClick', async () => {
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Regular Item',
            path: '/test-path',
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Regular Item')).toBeInTheDocument();
      });

      // Click the item
      fireEvent.click(screen.getByText('Regular Item'));

      expect(mockNavigate).toHaveBeenCalledWith('/test-path');
    });

    it('should close dropdown after clicking regular item', async () => {
      const section: MenuSection = {
        title: 'TEST',
        icon: { iconName: 'test', prefix: 'fas' } as any,
        items: [
          {
            label: 'Regular Item',
            path: '/test-path',
          },
        ],
      };

      renderNavDropdown(section);

      // Open dropdown
      const dropdownTrigger = screen.getByText('Test Label');
      fireEvent.mouseEnter(dropdownTrigger.parentElement!);

      await waitFor(() => {
        expect(screen.getByText('Regular Item')).toBeInTheDocument();
      });

      // Click the item
      fireEvent.click(screen.getByText('Regular Item'));

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('Regular Item')).not.toBeInTheDocument();
      });
    });
  });
});

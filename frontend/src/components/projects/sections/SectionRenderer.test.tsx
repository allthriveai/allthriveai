import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectSections } from './SectionRenderer';
import type { ProjectSection } from '@/types/sections';

// Mock the individual section components
vi.mock('./OverviewSection', () => ({
  OverviewSection: ({ content }: { content: { headline: string } }) => (
    <div data-testid="overview-section">{content.headline}</div>
  ),
}));

vi.mock('./FeaturesSection', () => ({
  FeaturesSection: () => <div data-testid="features-section">Features</div>,
}));

vi.mock('./TechStackSection', () => ({
  TechStackSection: () => <div data-testid="tech-stack-section">Tech Stack</div>,
}));

vi.mock('./GallerySection', () => ({
  GallerySection: () => <div data-testid="gallery-section">Gallery</div>,
}));

vi.mock('./ArchitectureSection', () => ({
  ArchitectureSection: () => <div data-testid="architecture-section">Architecture</div>,
}));

vi.mock('./DemoSection', () => ({
  DemoSection: () => <div data-testid="demo-section">Demo</div>,
}));

vi.mock('./ChallengesSection', () => ({
  ChallengesSection: () => <div data-testid="challenges-section">Challenges</div>,
}));

vi.mock('./LinksSection', () => ({
  LinksSection: () => <div data-testid="links-section">Links</div>,
}));

vi.mock('./CustomSection', () => ({
  CustomSection: () => <div data-testid="custom-section">Custom</div>,
}));

vi.mock('../editor/SectionTypePicker', () => ({
  SectionTypePicker: ({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) => (
    <div data-testid="section-type-picker">
      <button onClick={() => onSelect('custom')} data-testid="select-custom">Add Custom</button>
      <button onClick={onClose} data-testid="close-picker">Close</button>
    </div>
  ),
}));

// Mock @dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

vi.mock('@dnd-kit/modifiers', () => ({
  restrictToVerticalAxis: vi.fn(),
}));

describe('ProjectSections', () => {
  const mockSections: ProjectSection[] = [
    {
      id: 'section-overview-1',
      type: 'overview',
      enabled: true,
      order: 0,
      content: { headline: 'Test Project', description: 'A test project' },
    },
    {
      id: 'section-features-1',
      type: 'features',
      enabled: true,
      order: 1,
      content: { features: [] },
    },
    {
      id: 'section-architecture-1',
      type: 'architecture',
      enabled: true,
      order: 2,
      content: { diagram: 'graph TD\n    A --> B', description: 'Test' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders enabled sections in order', () => {
    render(<ProjectSections sections={mockSections} />);

    expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    expect(screen.getByTestId('features-section')).toBeInTheDocument();
    expect(screen.getByTestId('architecture-section')).toBeInTheDocument();
  });

  it('does not render disabled sections', () => {
    const sectionsWithDisabled: ProjectSection[] = [
      ...mockSections,
      {
        id: 'section-demo-1',
        type: 'demo',
        enabled: false,
        order: 3,
        content: { ctas: [] },
      },
    ];

    render(<ProjectSections sections={sectionsWithDisabled} />);

    expect(screen.queryByTestId('demo-section')).not.toBeInTheDocument();
  });

  it('shows empty state when no sections are enabled', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={[]}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    expect(screen.getByText('No sections yet')).toBeInTheDocument();
    expect(screen.getByText('Add Your First Section')).toBeInTheDocument();
  });

  it('shows add section buttons in editing mode', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    // Should have multiple "Add Section" buttons
    const addButtons = screen.getAllByText('Add Section');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('does not show add section buttons when not editing', () => {
    render(
      <ProjectSections
        sections={mockSections}
        isEditing={false}
      />
    );

    expect(screen.queryByText('Add Section')).not.toBeInTheDocument();
  });

  it('opens section type picker when add section is clicked', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    // Click the first "Add Section" button
    const addButtons = screen.getAllByText('Add Section');
    fireEvent.click(addButtons[0]);

    // Picker should be visible
    expect(screen.getByTestId('section-type-picker')).toBeInTheDocument();
  });

  it('calls onAddSection when a section type is selected', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    // Open picker
    const addButtons = screen.getAllByText('Add Section');
    fireEvent.click(addButtons[0]);

    // Select custom section type
    fireEvent.click(screen.getByTestId('select-custom'));

    expect(onAddSection).toHaveBeenCalledWith('custom', undefined);
  });

  it('calls onDeleteSection when delete button is clicked', () => {
    const onDeleteSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onDeleteSection={onDeleteSection}
      />
    );

    // Find and click delete button (should be one per section)
    const deleteButtons = screen.getAllByTitle('Delete section');
    fireEvent.click(deleteButtons[0]);

    expect(onDeleteSection).toHaveBeenCalledWith('section-overview-1');
  });

  it('handles undefined sections gracefully', () => {
    // @ts-expect-error - testing undefined handling
    render(<ProjectSections sections={undefined} />);

    // Should not crash and show nothing
    expect(screen.queryByTestId('overview-section')).not.toBeInTheDocument();
  });

  it('handles null sections gracefully', () => {
    // @ts-expect-error - testing null handling
    render(<ProjectSections sections={null} />);

    // Should not crash and show nothing
    expect(screen.queryByTestId('overview-section')).not.toBeInTheDocument();
  });

  it('sorts sections by order property', () => {
    const unorderedSections: ProjectSection[] = [
      {
        id: 'section-features-1',
        type: 'features',
        enabled: true,
        order: 2,
        content: { features: [] },
      },
      {
        id: 'section-overview-1',
        type: 'overview',
        enabled: true,
        order: 0,
        content: { headline: 'First', description: 'Test' },
      },
      {
        id: 'section-architecture-1',
        type: 'architecture',
        enabled: true,
        order: 1,
        content: { diagram: 'graph TD', description: 'Test' },
      },
    ];

    render(<ProjectSections sections={unorderedSections} />);

    const sections = screen.getAllByTestId(/-section$/);
    // Overview should come first (order: 0)
    expect(sections[0]).toHaveAttribute('data-testid', 'overview-section');
  });

  it('shows drag handles in editing mode with reorder callback', () => {
    const onReorderSections = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onReorderSections={onReorderSections}
      />
    );

    // Should have drag handles
    const dragHandles = screen.getAllByTitle('Drag to reorder');
    expect(dragHandles.length).toBe(mockSections.length);
  });
});

describe('ProjectSections - Add Section Position', () => {
  const mockSections: ProjectSection[] = [
    {
      id: 'section-1',
      type: 'overview',
      enabled: true,
      order: 0,
      content: { headline: 'Section 1', description: '' },
    },
    {
      id: 'section-2',
      type: 'features',
      enabled: true,
      order: 1,
      content: { features: [] },
    },
  ];

  it('calls onAddSection with afterSectionId when adding between sections', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    // The buttons after sections should have the section id
    const addButtons = screen.getAllByText('Add Section');
    // Second button should be after section-1
    fireEvent.click(addButtons[1]);

    // Select a type
    fireEvent.click(screen.getByTestId('select-custom'));

    // Should be called with the section id to insert after
    expect(onAddSection).toHaveBeenCalledWith('custom', 'section-1');
  });

  it('calls onAddSection with undefined when adding at top', () => {
    const onAddSection = vi.fn();

    render(
      <ProjectSections
        sections={mockSections}
        isEditing={true}
        onAddSection={onAddSection}
      />
    );

    // First button is at the top (no afterSectionId)
    const addButtons = screen.getAllByText('Add Section');
    fireEvent.click(addButtons[0]);

    // Select a type
    fireEvent.click(screen.getByTestId('select-custom'));

    // Should be called with undefined (insert at beginning)
    expect(onAddSection).toHaveBeenCalledWith('custom', undefined);
  });
});

# ExploreTemplate Component

A reusable, fully-featured template for creating "explore" or "browse" pages with search, filters, and masonry grid layout.

## Features

- **Responsive Masonry Grid**: CSS columns-based masonry layout with 2-5 column support
- **Search**: Built-in search bar with real-time filtering
- **Filters**: Flexible filter system with single/multi-select support
- **Loading States**: Animated skeleton loaders
- **Error Handling**: Styled error state display
- **Empty States**: Customizable empty and "no results" messages
- **Dark Mode**: Full dark mode support with glassmorphism effects

## Location

- **Component**: `frontend/src/components/layouts/ExploreTemplate.tsx`
- **Example Usage**: `frontend/src/pages/ExploreProjectsPage.tsx`

## Basic Usage

```typescript
import { ExploreTemplate } from '@/components/layouts/ExploreTemplate';
import { MyItemCard } from '@/components/MyItemCard';
import { PhotoIcon } from '@heroicons/react/24/outline';

export default function MyExplorePage() {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <ExploreTemplate
      title="Explore Items"
      subtitle="Browse our collection"
      icon={<PhotoIcon className="w-10 h-10" />}
      items={items}
      searchPlaceholder="Search items..."
      searchValue={searchQuery}
      onSearch={setSearchQuery}
      renderItem={(item) => <MyItemCard item={item} />}
      getItemKey={(item) => item.id}
      columns={4}
    />
  );
}
```

## Props

### Header Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ | Main page heading (h1) |
| `subtitle` | `string` | ❌ | Optional subtitle text below title |
| `icon` | `ReactNode` | ❌ | Optional icon displayed next to title |

### Data Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `T[]` | ✅ | Array of items to display |
| `isLoading` | `boolean` | ❌ | Show loading skeleton (default: false) |
| `error` | `string \| null` | ❌ | Error message to display (default: null) |

### Search Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `searchPlaceholder` | `string` | ❌ | Placeholder text for search input (default: "Search...") |
| `searchValue` | `string` | ❌ | Controlled search input value |
| `onSearch` | `(query: string) => void` | ❌ | Callback when search value changes |

### Filter Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filterGroups` | `FilterGroup[]` | ❌ | Array of filter group configurations |
| `activeFilters` | `Record<string, string[]>` | ❌ | Currently active filter values by group ID |
| `onFilterChange` | `(filterId: string, values: string[]) => void` | ❌ | Callback when filters change |

### Rendering Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `renderItem` | `(item: T, index: number) => ReactNode` | ✅ | Function to render each item |
| `getItemKey` | `(item: T) => string \| number` | ✅ | Function to get unique key for each item |

### Layout Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `2 \| 3 \| 4 \| 5` | ❌ | Number of columns in masonry grid (default: 4) |
| `emptyMessage` | `string` | ❌ | Message when no items (default: "No items found") |
| `emptySearchMessage` | `string` | ❌ | Message when search has no results |

## Filter System

### FilterGroup Interface

```typescript
interface FilterGroup {
  id: string;              // Unique identifier for the filter group
  label: string;           // Display label for the filter group
  options: FilterOption[]; // Available filter options
  multiSelect?: boolean;   // Allow multiple selections (default: false)
}

interface FilterOption {
  id: string;    // Unique identifier for the option
  label: string; // Display label for the option
  value: string; // Value to filter by
  count?: number; // Optional count badge
}
```

### Example: Multi-Select Filters

```typescript
const filterGroups: FilterGroup[] = [
  {
    id: 'type',
    label: 'Project Type',
    multiSelect: true, // Allow multiple selections
    options: [
      { id: 'type-github', label: 'GitHub Repo', value: 'github_repo', count: 42 },
      { id: 'type-image', label: 'Image Collection', value: 'image_collection', count: 18 },
      { id: 'type-prompt', label: 'Prompt', value: 'prompt', count: 7 },
    ],
  },
  {
    id: 'featured',
    label: 'Featured',
    multiSelect: false, // Single selection only
    options: [
      { id: 'showcase', label: '⭐ Showcase Only', value: 'true', count: 12 },
    ],
  },
];
```

### Handling Filter Changes

```typescript
const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

function handleFilterChange(filterId: string, values: string[]) {
  setActiveFilters(prev => ({
    ...prev,
    [filterId]: values,
  }));
}

// In your filtering logic:
function applyFilters() {
  let filtered = [...allItems];

  if (activeFilters.type && activeFilters.type.length > 0) {
    filtered = filtered.filter(item =>
      activeFilters.type.includes(item.type)
    );
  }

  if (activeFilters.featured && activeFilters.featured.includes('true')) {
    filtered = filtered.filter(item => item.isFeatured);
  }

  return filtered;
}
```

## Masonry Grid

The component uses CSS columns for a true masonry layout. Items flow naturally from top to bottom, then left to right.

### Column Breakpoints

| Columns | Tailwind Classes | Breakpoints |
|---------|------------------|-------------|
| 2 | `sm:columns-2` | 1 col mobile, 2 cols tablet+ |
| 3 | `sm:columns-2 lg:columns-3` | 1/2/3 cols by screen size |
| 4 | `sm:columns-2 lg:columns-3 xl:columns-4` | 1/2/3/4 cols by screen size |
| 5 | `sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5` | 1/2/3/4/5 cols by screen size |

### Item Rendering Tips

1. **Break-inside-avoid**: Each item wrapper has `break-inside-avoid` to prevent column breaks within items
2. **Variable Heights**: Items can have different heights - the masonry layout handles this automatically
3. **Spacing**: Use `mb-4` on the wrapper for consistent vertical spacing

```typescript
renderItem={(project) => (
  // The wrapper with break-inside-avoid is handled by the template
  <ProjectCard project={project} variant="masonry" />
)}
```

## Loading States

The template includes animated skeleton loaders that match the masonry grid layout:

- Displays 12 placeholder cards with varying heights
- Respects the selected column count
- Uses pulse animation for shimmer effect

## Error Handling

Errors are displayed in a styled glass panel with red accents:

```typescript
<ExploreTemplate
  items={items}
  error="Failed to load items. Please try again."
  // ... other props
/>
```

## Complete Example

See `frontend/src/pages/ExploreProjectsPage.tsx` for a full implementation example with:

- API data fetching
- Search implementation
- Multiple filter groups (type, featured, tags)
- Dynamic filter counts
- Loading and error states
- Masonry grid with ProjectCard components

## Styling

The template uses:
- **Glass effects**: `glass-subtle`, `glass-strong` classes from `index.css`
- **Primary colors**: For filter badges, active states
- **Dark mode**: Full support with `dark:` variants
- **Transitions**: Smooth hover and state changes

## Best Practices

1. **Always provide `getItemKey`**: Ensures proper React list reconciliation
2. **Handle loading states**: Set `isLoading={true}` during data fetching
3. **Filter on the parent**: Keep filtering logic in the parent component for flexibility
4. **Use debouncing**: For search to avoid excessive re-renders
5. **Dynamic filter counts**: Update filter counts when items change
6. **Appropriate columns**: 3-4 columns work best for most content

## Accessibility

- Search input has proper placeholder and labels
- Filter buttons have hover and focus states
- Error messages use semantic colors
- Keyboard navigation supported throughout

## Performance Tips

1. **Memoize renderItem**: Use `React.memo` on item components
2. **Virtualization**: For very large lists, consider react-window
3. **Pagination**: Load items in batches for better performance
4. **Debounced search**: Delay search callback by 300-500ms

```typescript
import { useMemo, useCallback } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    // Perform search
  }, 300),
  []
);
```

## Related Components

- **ProjectCard**: Pre-built card with masonry variant
- **DashboardLayout**: Wrapper layout used by ExploreTemplate
- **ToolDirectoryPage**: Another example of a browse/explore pattern

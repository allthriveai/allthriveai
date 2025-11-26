# Default Banner Images for Projects

## Overview

When a user creates a new project, a default banner image is automatically assigned if they don't provide one. This ensures that all projects have visually appealing thumbnails from the start.

## Implementation

### Backend

The backend automatically assigns a default banner image when creating a project if the `thumbnail_url` field is empty.

#### Constants (`core/projects/constants.py`)

```python
# Default banner images for projects (when user doesn't provide one)
DEFAULT_BANNER_IMAGES = [
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=400&fit=crop',  # Gradient abstract
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&h=400&fit=crop',  # Gradient purple
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=400&fit=crop',  # Gradient blue
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&h=400&fit=crop',  # Gradient warm
    'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=400&fit=crop',  # Gradient teal
]

DEFAULT_BANNER_IMAGE = DEFAULT_BANNER_IMAGES[0]
```

#### Serializer (`core/projects/serializers.py`)

The `ProjectSerializer` has a `create()` method that automatically sets the default banner:

```python
def create(self, validated_data):
    """Create a new project with default banner image if not provided."""
    # Set default banner image if thumbnail_url is not provided or empty
    if not validated_data.get('thumbnail_url'):
        validated_data['thumbnail_url'] = DEFAULT_BANNER_IMAGE
    return super().create(validated_data)
```

### Frontend

The frontend can optionally provide a `thumbnailUrl` when creating a project. If not provided, the backend will automatically assign the default banner.

#### Project Creation

When creating a project via the API:

```typescript
// Without thumbnail - backend will assign default
await createProject({
  title: 'My New Project',
  description: 'Project description',
  type: 'other',
  isShowcase: false,
  content: { blocks: [] },
});

// With custom thumbnail
await createProject({
  title: 'My New Project',
  description: 'Project description',
  type: 'other',
  isShowcase: false,
  thumbnailUrl: 'https://example.com/my-custom-banner.jpg',
  content: { blocks: [] },
});
```

#### Project Display

The `ProjectCard` component automatically displays the thumbnail with a fallback:

```tsx
<img
  src={project.thumbnailUrl || '/allthrive-placeholder.svg'}
  alt={project.title}
  className="w-full h-auto object-cover"
/>
```

## User Flow

1. **User creates a project** - User clicks "Add Project" button
2. **Backend creates project** - If `thumbnail_url` is empty, the backend assigns `DEFAULT_BANNER_IMAGE`
3. **Project is displayed** - The project card shows the default banner image
4. **User can customize** - User can later edit the project and change the banner image

## Customizing Default Banners

To change or add more default banner images:

1. Edit `core/projects/constants.py`
2. Add new URLs to the `DEFAULT_BANNER_IMAGES` list
3. Optionally change `DEFAULT_BANNER_IMAGE` to use a different default

### Banner Image Requirements

- **Aspect ratio**: 2:1 (e.g., 800x400)
- **Format**: JPEG, PNG, or WebP
- **Size**: Optimized for web (< 200KB recommended)
- **Content**: Abstract patterns, gradients, or generic professional images

### Using Your Own Images

You can host your own default banner images:

1. Upload images to your media storage (MinIO/S3)
2. Update the URLs in `DEFAULT_BANNER_IMAGES`
3. Ensure images are publicly accessible

Example with local media:

```python
DEFAULT_BANNER_IMAGES = [
    '/media/defaults/banner-1.jpg',
    '/media/defaults/banner-2.jpg',
    '/media/defaults/banner-3.jpg',
]
```

## Future Enhancements

### Random Banner Selection

Instead of always using the same default, randomly select from the list:

```python
import random

def create(self, validated_data):
    if not validated_data.get('thumbnail_url'):
        validated_data['thumbnail_url'] = random.choice(DEFAULT_BANNER_IMAGES)
    return super().create(validated_data)
```

### User Preference

Allow users to set their preferred default banner:

```python
# In User model
default_project_banner = models.CharField(max_length=500, blank=True)

# In serializer
def create(self, validated_data):
    if not validated_data.get('thumbnail_url'):
        user = validated_data['user']
        validated_data['thumbnail_url'] = (
            user.default_project_banner or DEFAULT_BANNER_IMAGE
        )
    return super().create(validated_data)
```

### Project Type-Specific Banners

Different default banners based on project type:

```python
DEFAULT_BANNERS_BY_TYPE = {
    'github_repo': 'https://example.com/code-banner.jpg',
    'image_collection': 'https://example.com/gallery-banner.jpg',
    'prompt': 'https://example.com/prompt-banner.jpg',
    'other': DEFAULT_BANNER_IMAGE,
}

def create(self, validated_data):
    if not validated_data.get('thumbnail_url'):
        project_type = validated_data.get('type', 'other')
        validated_data['thumbnail_url'] = DEFAULT_BANNERS_BY_TYPE.get(
            project_type, DEFAULT_BANNER_IMAGE
        )
    return super().create(validated_data)
```

## Testing

### Backend Tests

```python
def test_project_creation_with_default_banner(self):
    """Test that projects get a default banner when created without one."""
    project = Project.objects.create(
        user=self.user,
        title='Test Project',
        # No thumbnail_url provided
    )
    self.assertEqual(project.thumbnail_url, DEFAULT_BANNER_IMAGE)

def test_project_creation_with_custom_banner(self):
    """Test that custom banners are preserved."""
    custom_url = 'https://example.com/custom.jpg'
    project = Project.objects.create(
        user=self.user,
        title='Test Project',
        thumbnail_url=custom_url,
    )
    self.assertEqual(project.thumbnail_url, custom_url)
```

### Frontend Tests

```typescript
it('creates project with default banner from backend', async () => {
  const project = await createProject({
    title: 'New Project',
    type: 'other',
    isShowcase: false,
    content: { blocks: [] },
  });

  expect(project.thumbnailUrl).toBeTruthy();
  expect(project.thumbnailUrl).toContain('https://');
});
```

## Related Files

- `core/projects/constants.py` - Default banner configuration
- `core/projects/serializers.py` - Banner assignment logic
- `core/projects/models.py` - Project model with thumbnail_url field
- `frontend/src/services/projects.ts` - Project creation API
- `frontend/src/components/projects/ProjectCard.tsx` - Banner display

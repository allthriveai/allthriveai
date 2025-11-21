"""Tests for Project model and API endpoints."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from core.projects.constants import DEFAULT_BANNER_IMAGE
from core.projects.models import Project

User = get_user_model()


class ProjectModelTest(TestCase):
    """Test the Project model, especially slug generation."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.other_user = User.objects.create_user(
            username='otheruser', email='other@example.com', password='otherpass123'
        )

    def test_project_creation_with_title(self):
        """Test project is created successfully with a title."""
        project = Project.objects.create(user=self.user, title='My Cool Project')
        self.assertEqual(project.title, 'My Cool Project')
        self.assertEqual(project.slug, 'my-cool-project')
        self.assertEqual(project.user, self.user)

    def test_slug_auto_generation_from_title(self):
        """Test that slug is auto-generated from title if not provided."""
        project = Project.objects.create(user=self.user, title='Another Test Project')
        self.assertEqual(project.slug, 'another-test-project')

    def test_slug_collision_handling_same_user(self):
        """Test that slug collisions are handled with numeric suffixes for the same user."""
        # Create first project
        project1 = Project.objects.create(user=self.user, title='My Project')
        self.assertEqual(project1.slug, 'my-project')

        # Create second project with same title for same user
        project2 = Project.objects.create(user=self.user, title='My Project')
        self.assertEqual(project2.slug, 'my-project-2')

        # Create third project
        project3 = Project.objects.create(user=self.user, title='My Project')
        self.assertEqual(project3.slug, 'my-project-3')

    def test_slug_no_collision_different_users(self):
        """Test that different users can have the same slug."""
        project1 = Project.objects.create(user=self.user, title='Shared Title')
        project2 = Project.objects.create(user=self.other_user, title='Shared Title')
        # Both should have the same slug since they're for different users
        self.assertEqual(project1.slug, 'shared-title')
        self.assertEqual(project2.slug, 'shared-title')

    def test_unique_constraint_per_user(self):
        """Test that (user, slug) combination must be unique."""
        Project.objects.create(user=self.user, title='Test', slug='test-slug')

        # Attempting to create another with same slug for same user should fail
        # The model handles this automatically by appending suffixes
        project2 = Project.objects.create(user=self.user, slug='test-slug', title='Another Test')
        self.assertEqual(project2.slug, 'test-slug-2')

    def test_slug_with_special_characters(self):
        """Test that special characters are properly handled in slugs."""
        project = Project.objects.create(user=self.user, title='My Cool Project! @#$% & Stuff')
        # Django's slugify converts to lowercase and removes special chars
        self.assertEqual(project.slug, 'my-cool-project-stuff')

    def test_slug_with_unicode(self):
        """Test slug generation with unicode characters."""
        project = Project.objects.create(user=self.user, title='Café Résumé')
        # Django slugify handles unicode
        self.assertEqual(project.slug, 'cafe-resume')

    def test_empty_title_generates_project_slug(self):
        """Test that empty title generates 'project' as slug."""
        project = Project.objects.create(user=self.user, title='')
        self.assertEqual(project.slug, 'project')

    def test_project_types(self):
        """Test all project type choices."""
        types = [
            Project.ProjectType.GITHUB_REPO,
            Project.ProjectType.IMAGE_COLLECTION,
            Project.ProjectType.PROMPT,
            Project.ProjectType.OTHER,
        ]
        for project_type in types:
            project = Project.objects.create(user=self.user, title=f'Test {project_type}', type=project_type)
            self.assertEqual(project.type, project_type)

    def test_project_showcase_flag(self):
        """Test is_showcase flag."""
        project = Project.objects.create(user=self.user, title='Showcase Project', is_showcase=True)
        self.assertTrue(project.is_showcase)

    def test_project_content_json(self):
        """Test that content field stores JSON correctly."""
        content = {
            'coverImage': {'url': 'https://example.com/cover.jpg', 'alt': 'Cover'},
            'tags': ['ai', 'python'],
            'blocks': [
                {'type': 'text', 'style': 'body', 'content': 'Description'},
                {'type': 'image', 'url': 'https://example.com/img.jpg'},
            ],
        }
        project = Project.objects.create(user=self.user, title='Rich Project', content=content)
        self.assertEqual(project.content, content)

    def test_project_str_method(self):
        """Test project string representation."""
        project = Project.objects.create(user=self.user, title='Test Project', slug='test-project')
        expected = f'Test Project ({self.user.username}/test-project)'
        self.assertEqual(str(project), expected)


class ProjectAPITest(APITestCase):
    """Test Project API endpoints with authentication and user isolation."""

    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', email='user1@example.com', password='pass123')
        self.user2 = User.objects.create_user(username='user2', email='user2@example.com', password='pass123')

    def test_create_project_authenticated(self):
        """Test that authenticated user can create a project."""
        self.client.force_authenticate(user=self.user1)
        data = {'title': 'My API Project', 'description': 'Created via API', 'type': 'github_repo'}
        response = self.client.post('/api/v1/me/projects/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['title'], 'My API Project')
        self.assertEqual(response.data['slug'], 'my-api-project')
        self.assertEqual(response.data['username'], 'user1')

    def test_create_project_unauthenticated(self):
        """Test that unauthenticated requests are rejected."""
        data = {'title': 'Test'}
        response = self.client.post('/api/v1/me/projects/', data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_cannot_set_user_id(self):
        """Test that user_id is always derived from auth context, never from client."""
        self.client.force_authenticate(user=self.user1)
        data = {
            'title': 'Hacked Project',
            'user': self.user2.id,  # Attempt to set different user
            'user_id': self.user2.id,
        }
        response = self.client.post('/api/v1/me/projects/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should be created for user1, not user2
        project = Project.objects.get(id=response.data['id'])
        self.assertEqual(project.user, self.user1)

    def test_list_projects_only_own(self):
        """Test that users only see their own projects."""
        # Create projects for both users
        Project.objects.create(user=self.user1, title='User1 Project 1')
        Project.objects.create(user=self.user1, title='User1 Project 2')
        Project.objects.create(user=self.user2, title='User2 Project')

        # Login as user1
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/v1/me/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Handle paginated response
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 2)
        titles = [p['title'] for p in results]
        self.assertIn('User1 Project 1', titles)
        self.assertIn('User1 Project 2', titles)
        self.assertNotIn('User2 Project', titles)

    def test_cannot_access_other_user_project(self):
        """Test that user cannot access another user's project."""
        project = Project.objects.create(user=self.user2, title='User2 Private')

        # Login as user1 and try to access user2's project
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f'/api/v1/me/projects/{project.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_update_other_user_project(self):
        """Test that user cannot update another user's project."""
        project = Project.objects.create(user=self.user2, title='User2 Project')

        self.client.force_authenticate(user=self.user1)
        data = {'title': 'Hacked Title'}
        response = self.client.patch(f'/api/v1/me/projects/{project.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify project wasn't modified
        project.refresh_from_db()
        self.assertEqual(project.title, 'User2 Project')

    def test_cannot_delete_other_user_project(self):
        """Test that user cannot delete another user's project."""
        project = Project.objects.create(user=self.user2, title='User2 Project')

        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f'/api/v1/me/projects/{project.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify project still exists
        self.assertTrue(Project.objects.filter(id=project.id).exists())

    def test_update_own_project(self):
        """Test that user can update their own project."""
        project = Project.objects.create(user=self.user1, title='Original Title')

        self.client.force_authenticate(user=self.user1)
        data = {'title': 'Updated Title', 'description': 'New description', 'is_showcase': True}
        response = self.client.patch(f'/api/v1/me/projects/{project.id}/', data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated Title')
        self.assertEqual(response.data['description'], 'New description')
        self.assertTrue(response.data['is_showcase'])

    def test_delete_own_project(self):
        """Test that user can delete their own project."""
        project = Project.objects.create(user=self.user1, title='To Delete')

        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f'/api/v1/me/projects/{project.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Project.objects.filter(id=project.id).exists())

    def test_content_validation_must_be_dict(self):
        """Test that content must be a JSON object."""
        self.client.force_authenticate(user=self.user1)
        data = {'title': 'Test', 'content': 'not a dict'}
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content', response.data)

    def test_content_size_limit(self):
        """Test that content size is limited."""
        self.client.force_authenticate(user=self.user1)
        # Create content larger than 100KB
        large_content = {'blocks': [{'type': 'text', 'content': 'x' * 101000}]}
        data = {'title': 'Large Project', 'content': large_content}
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content', response.data)

    def test_thumbnail_url_validation(self):
        """Test that invalid thumbnail URLs are rejected."""
        self.client.force_authenticate(user=self.user1)
        data = {'title': 'Test', 'thumbnail_url': 'not-a-valid-url'}
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('thumbnail_url', response.data)

    def test_project_ordering(self):
        """Test that projects are ordered by creation date (newest first)."""
        self.client.force_authenticate(user=self.user1)

        # Create projects in order
        p1 = Project.objects.create(user=self.user1, title='First')
        p2 = Project.objects.create(user=self.user1, title='Second')
        p3 = Project.objects.create(user=self.user1, title='Third')

        response = self.client.get('/api/v1/me/projects/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Handle paginated response
        results = response.data.get('results', response.data)
        # Should be reverse chronological order
        titles = [p['title'] for p in results]
        self.assertEqual(titles, ['Third', 'Second', 'First'])

    def test_readonly_fields(self):
        """Test that read-only fields cannot be set via API."""
        self.client.force_authenticate(user=self.user1)
        data = {
            'title': 'Test Project',
            'username': 'hacker',  # Readonly field
            'created_at': '2020-01-01T00:00:00Z',  # Readonly field
        }
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # username should be from auth user, not the provided value
        self.assertEqual(response.data['username'], 'user1')

    def test_default_banner_image_on_create(self):
        """Test that projects get a default banner image when created without one."""
        self.client.force_authenticate(user=self.user1)
        data = {
            'title': 'Project Without Banner',
            'description': 'This project should get a default banner',
            'type': 'other',
        }
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should have the default banner image
        self.assertEqual(response.data['thumbnail_url'], DEFAULT_BANNER_IMAGE)
        # Verify in database
        project = Project.objects.get(id=response.data['id'])
        self.assertEqual(project.thumbnail_url, DEFAULT_BANNER_IMAGE)

    def test_custom_banner_preserved_on_create(self):
        """Test that custom banner images are preserved when provided."""
        self.client.force_authenticate(user=self.user1)
        custom_url = 'https://example.com/custom-banner.jpg'
        data = {
            'title': 'Project With Custom Banner',
            'description': 'This project has a custom banner',
            'type': 'other',
            'thumbnail_url': custom_url,
        }
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should preserve the custom banner
        self.assertEqual(response.data['thumbnail_url'], custom_url)
        # Verify in database
        project = Project.objects.get(id=response.data['id'])
        self.assertEqual(project.thumbnail_url, custom_url)

    def test_hero_display_fields_in_content(self):
        """Test that hero display fields are accepted in content."""
        self.client.force_authenticate(user=self.user1)
        content = {
            'blocks': [{'type': 'text', 'content': 'Test content'}],
            'heroDisplayMode': 'quote',
            'heroQuote': 'This is a test quote',
            'heroVideoUrl': '',
            'heroSlideshowImages': [],
        }
        data = {'title': 'Hero Test Project', 'content': content}
        response = self.client.post('/api/v1/me/projects/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Verify hero fields are preserved
        self.assertEqual(response.data['content']['heroDisplayMode'], 'quote')
        self.assertEqual(response.data['content']['heroQuote'], 'This is a test quote')
        self.assertEqual(response.data['content']['heroVideoUrl'], '')
        self.assertEqual(response.data['content']['heroSlideshowImages'], [])

"""
Tests for user profile update functionality, including username changes.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class ProfileUpdateTestCase(TestCase):
    """Test profile update functionality."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            first_name='Test',
            last_name='User'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_update_username_success(self):
        """Test that users can update their username."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'newusername'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify username was updated
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'newusername')
    
    def test_update_username_to_existing_fails(self):
        """Test that updating to an existing username fails."""
        # Create another user
        User.objects.create_user(
            username='existinguser',
            email='existing@example.com',
            password='testpass123'
        )
        
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'existinguser'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
    
    def test_update_username_too_short_fails(self):
        """Test that username shorter than 3 characters fails."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'ab'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
    
    def test_update_username_invalid_characters_fails(self):
        """Test that username with invalid characters fails."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'test user'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)
    
    def test_update_username_normalized_to_lowercase(self):
        """Test that username is normalized to lowercase."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'NewUserName'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify username was normalized
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'newusername')
    
    def test_update_other_profile_fields(self):
        """Test updating other profile fields works as before."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {
                'first_name': 'Updated',
                'last_name': 'Name',
                'bio': 'Updated bio'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertEqual(self.user.last_name, 'Name')
        self.assertEqual(self.user.bio, 'Updated bio')
    
    def test_update_username_and_other_fields_together(self):
        """Test updating username along with other fields."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {
                'username': 'updateduser',
                'first_name': 'Updated',
                'bio': 'New bio'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'updateduser')
        self.assertEqual(self.user.first_name, 'Updated')
        self.assertEqual(self.user.bio, 'New bio')
    
    def test_username_unchanged_when_same(self):
        """Test that submitting the same username doesn't cause errors."""
        response = self.client.patch(
            '/api/v1/me/profile/',
            {'username': 'testuser'},  # Same as current username
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'testuser')

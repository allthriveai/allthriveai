"""
Test fixtures and common test data.

This module provides reusable test fixtures, mock data, and helper functions
to reduce duplication across test files.
"""

from unittest.mock import Mock


def create_mock_reddit_post_data(
    title='Test Post',
    author='testauthor',
    url='https://reddit.com/r/test/comments/123/test',
    score=100,
    num_comments=10,
    created_utc=1234567890.0,
    selftext='Test content',
    **kwargs,
):
    """
    Create mock Reddit post data with common fields.

    Args:
        title: Post title
        author: Post author username
        url: Post URL
        score: Post score
        num_comments: Number of comments
        created_utc: Creation timestamp
        selftext: Post text content
        **kwargs: Additional fields to override or add

    Returns:
        Dictionary with Reddit post data
    """
    base_data = {
        'title': title,
        'author': author,
        'url': url,
        'score': score,
        'num_comments': num_comments,
        'created_utc': created_utc,
        'selftext': selftext,
        'selftext_html': '',
        'post_hint': '',
        'link_flair_text': '',
        'link_flair_background_color': '',
        'is_video': False,
        'video_url': '',
        'video_duration': 0,
        'is_gallery': False,
    }
    base_data.update(kwargs)
    return base_data


def create_mock_github_repo_data(
    name='test-repo',
    owner='testowner',
    description='Test repository',
    stars=100,
    language='Python',
    **kwargs,
):
    """
    Create mock GitHub repository data.

    Args:
        name: Repository name
        owner: Repository owner
        description: Repository description
        stars: Number of stars
        language: Primary language
        **kwargs: Additional fields

    Returns:
        Dictionary with GitHub repo data
    """
    base_data = {
        'name': name,
        'owner': owner,
        'description': description,
        'stars': stars,
        'language': language,
        'url': f'https://github.com/{owner}/{name}',
    }
    base_data.update(kwargs)
    return base_data


def create_mock_youtube_video_data(
    video_id='test123',
    title='Test Video',
    description='Test description',
    thumbnail_url='https://example.com/thumb.jpg',
    **kwargs,
):
    """
    Create mock YouTube video data.

    Args:
        video_id: YouTube video ID
        title: Video title
        description: Video description
        thumbnail_url: Thumbnail URL
        **kwargs: Additional fields

    Returns:
        Dictionary with YouTube video data
    """
    base_data = {
        'id': video_id,
        'snippet': {
            'title': title,
            'description': description,
            'thumbnails': {'high': {'url': thumbnail_url}},
        },
    }
    base_data.update(kwargs)
    return base_data


def create_mock_ai_response(content='Test AI response', **kwargs):
    """
    Create mock AI provider response.

    Args:
        content: Response content
        **kwargs: Additional response attributes

    Returns:
        Mock response object
    """
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = content
    for key, value in kwargs.items():
        setattr(mock_response, key, value)
    return mock_response


def create_mock_request(user):
    """
    Create a mock Django request object.

    Args:
        user: User instance to attach to request

    Returns:
        Mock request object
    """

    class MockRequest:
        def __init__(self, user):
            self.user = user

    return MockRequest(user)


class MockStreamEvent:
    """Mock streaming event for agent tests."""

    def __init__(self, event_type='token', data=None):
        """
        Initialize mock stream event.

        Args:
            event_type: Type of event (token, metadata, etc.)
            data: Event data
        """
        self.event_type = event_type
        self.data = data or {}

    def __iter__(self):
        """Make the event iterable for async iteration."""
        return iter([self])


def create_mock_agent_stream_events(num_events=3, event_type='token'):
    """
    Create a list of mock agent stream events.

    Args:
        num_events: Number of events to create
        event_type: Type of events

    Returns:
        List of mock stream events
    """
    return [MockStreamEvent(event_type=event_type, data={'index': i}) for i in range(num_events)]

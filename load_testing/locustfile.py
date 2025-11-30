"""
Load Testing for AllThrive AI Intelligent Chat
Simulates real user behavior for scalability testing (target: 100k users)

Test Scenarios:
1. Basic browsing (view projects, explore)
2. Chat interactions (support questions, project creation)
3. GitHub/YouTube imports (full project creation flow)
4. WebSocket connections (Phase 2+)

Usage:
    locust -f locustfile.py --host=http://<your-server-host>:8000

Web UI: http://<your-locust-host>:8089
"""

import random

from locust import HttpUser, between, events, task
from locust.contrib.fasthttp import FastHttpUser


class AllThriveUser(HttpUser):
    """
    Simulates a realistic user journey through AllThrive AI

    Weight distribution (reflects real usage):
    - 50% browsing/exploring
    - 30% chat interactions
    - 15% project creation
    - 5% authentication flows
    """

    wait_time = between(1, 5)  # 1-5 seconds between tasks (realistic human behavior)

    def on_start(self):
        """Called when a simulated user starts - login if needed"""
        self.project_id = None
        self.conversation_id = None

        # Simulate 70% authenticated users, 30% anonymous
        if random.random() < 0.7:
            self.login()

    def login(self):
        """Simulate user login (will need real test credentials)"""
        # For now, skip actual login - will add in Phase 1 with auth
        self.authenticated = True

    @task(50)
    def browse_projects(self):
        """Browse project listings (most common user action)"""
        with self.client.get('/api/v1/projects/', name='/api/v1/projects/', catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f'Got status {response.status_code}')

    @task(30)
    def view_project_detail(self):
        """View individual project page"""
        # Simulate viewing a random project (1-100)
        project_id = random.randint(1, 100)
        with self.client.get(
            f'/api/v1/projects/{project_id}/', name='/api/v1/projects/[id]/', catch_response=True
        ) as response:
            if response.status_code in [200, 404]:  # 404 is ok (project doesn't exist)
                response.success()
            else:
                response.failure(f'Got status {response.status_code}')

    @task(20)
    def explore_tools(self):
        """Browse tools/technologies"""
        with self.client.get('/api/v1/tools/', name='/api/v1/tools/', catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f'Got status {response.status_code}')

    @task(15)
    def chat_support_question(self):
        """
        Send a support question to the chat agent
        (Will use SSE endpoint in Phase 1, WebSocket in Phase 2)
        """
        questions = [
            'How do I add a project?',
            'What is AllThrive AI?',
            'Can I import from GitHub?',
            'How do I upload a video?',
            'What tools can I use?',
        ]

        message = random.choice(questions)

        # For now, test the basic endpoint (will add streaming in Phase 2)
        with self.client.post(
            '/api/v1/project/chat/stream/',
            json={'message': message},
            name='/api/v1/project/chat/stream/',
            catch_response=True,
        ) as response:
            if response.status_code in [200, 401]:  # 401 is ok (not authenticated)
                response.success()
            else:
                response.failure(f'Chat failed with status {response.status_code}')

    @task(10)
    def search_projects(self):
        """Search for projects by keyword"""
        keywords = ['react', 'python', 'ai', 'dashboard', 'api']
        keyword = random.choice(keywords)

        with self.client.get(
            f'/api/v1/projects/?search={keyword}', name='/api/v1/projects/?search=[keyword]', catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f'Search failed with status {response.status_code}')

    @task(5)
    def view_profile(self):
        """View user profile (authenticated users only)"""
        if not getattr(self, 'authenticated', False):
            return  # Skip for anonymous users

        with self.client.get('/api/v1/users/me/', name='/api/v1/users/me/', catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f'Profile view failed with status {response.status_code}')

    @task(3)
    def check_github_status(self):
        """Check GitHub connection status (before import)"""
        with self.client.get(
            '/api/v1/social/status/google/', name='/api/v1/social/status/', catch_response=True
        ) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f'Status check failed with status {response.status_code}')


class ChatHeavyUser(FastHttpUser):
    """
    Simulates users who primarily use chat (higher load on agent)
    Uses FastHttpUser for better WebSocket performance (Phase 2+)

    This user profile focuses on intensive chat usage to test:
    - LangGraph agent performance
    - Conversation persistence
    - Rate limiting
    - Circuit breaker under high load
    """

    wait_time = between(0.5, 2)  # Faster interaction (active chat users)

    @task(80)
    def send_chat_messages(self):
        """Rapid-fire chat messages (stress test)"""
        messages = [
            'Tell me about AllThrive',
            'https://github.com/django/django',
            'https://youtube.com/watch?v=dQw4w9WgXcQ',
            'I want to upload a file',
            'What tools do you support?',
            'Can you help me create a project?',
            "What's the best way to showcase my work?",
        ]

        message = random.choice(messages)

        with self.client.post(
            '/api/v1/project/chat/stream/',
            json={'message': message},
            name='/api/v1/project/chat/stream/ (heavy)',
            catch_response=True,
        ) as response:
            if response.status_code in [200, 401, 429]:  # 429 = rate limited (expected)
                response.success()
            else:
                response.failure(f'Chat failed with status {response.status_code}')

    @task(20)
    def rapid_project_views(self):
        """Quick browsing between chat sessions"""
        project_id = random.randint(1, 100)
        with self.client.get(
            f'/api/v1/projects/{project_id}/', name='/api/v1/projects/[id]/ (heavy)', catch_response=True
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f'Got status {response.status_code}')


class ProjectCreatorUser(HttpUser):
    """
    Simulates users creating projects (highest backend load)

    This profile tests:
    - GitHub/YouTube API integration
    - Celery task queue
    - PostgreSQL write performance
    - Redis caching
    """

    wait_time = between(3, 10)  # Longer wait (project creation takes time)

    @task(50)
    def import_github_repo(self):
        """Attempt GitHub import (will fail without auth, tests endpoint)"""
        repos = [
            'https://github.com/django/django',
            'https://github.com/facebook/react',
            'https://github.com/openai/gpt-4',
        ]

        with self.client.post(
            '/api/v1/integrations/github/import/',
            json={'url': random.choice(repos)},
            name='/api/v1/integrations/github/import/',
            catch_response=True,
        ) as response:
            if response.status_code in [200, 401, 403]:  # Auth required
                response.success()
            else:
                response.failure(f'GitHub import failed with status {response.status_code}')

    @task(30)
    def import_youtube_video(self):
        """Attempt YouTube import"""
        videos = [
            'https://youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtube.com/watch?v=9bZkp7q19f0',
        ]

        with self.client.post(
            '/api/v1/integrations/youtube/import/',
            json={'url': random.choice(videos)},
            name='/api/v1/integrations/youtube/import/',
            catch_response=True,
        ) as response:
            if response.status_code in [200, 401, 403]:
                response.success()
            else:
                response.failure(f'YouTube import failed with status {response.status_code}')

    @task(20)
    def view_my_projects(self):
        """Check created projects"""
        with self.client.get(
            '/api/v1/users/me/projects/', name='/api/v1/users/me/projects/', catch_response=True
        ) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f'Got status {response.status_code}')


# Event hooks for custom metrics
@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Track custom metrics for Prometheus"""
    # Will integrate with Prometheus in Phase 1
    pass


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Run once at the start of the test"""
    print('🚀 Load test starting...')
    print(f'   Target: {environment.host}')
    print(
        f'   Users: {environment.runner.target_user_count if hasattr(environment.runner, "target_user_count") else "N/A"}'
    )


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Run once at the end of the test"""
    print('✅ Load test complete!')
    stats = environment.runner.stats
    print(f'   Total requests: {stats.total.num_requests}')
    print(f'   Failures: {stats.total.num_failures}')
    print(f'   Avg response time: {stats.total.avg_response_time:.2f}ms')

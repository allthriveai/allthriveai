"""
SEO views for LLM discoverability.

Implements the llms.txt specification (https://llmstxt.org/) to help
AI tools and LLMs discover and index project content.
"""

from django.core.cache import cache
from django.http import HttpResponse
from django.views import View

from core.projects.models import Project


class LlmsTxtView(View):
    """Generate llms.txt index of all public projects.

    Following the llms.txt specification, this provides a machine-readable
    index of all public projects with links to their context-md endpoints.

    Cache duration: 1 hour (invalidated when any project is saved/deleted)
    """

    def get(self, request):
        cache_key = 'llms_txt_v1'
        content = cache.get(cache_key)

        if content is None:
            projects = (
                Project.objects.filter(
                    is_private=False,
                    is_archived=False,
                    is_showcased=True,
                    user__is_profile_public=True,
                    user__is_active=True,
                )
                .select_related('user')
                .order_by('-engagement_velocity')[:500]
            )

            content = render_llms_txt(projects, request)
            cache.set(cache_key, content, 3600)  # 1 hour

        return HttpResponse(content, content_type='text/plain; charset=utf-8')


def render_llms_txt(projects, request) -> str:
    """Render llms.txt content following the specification.

    Format:
    # Site Title
    > Site description
    ## Section
    - [Item Title](url): Description
    """
    base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash

    lines = [
        '# AllThrive AI Projects',
        '',
        '> AI-powered learning platform with projects, tools, and educational content.',
        '',
        '## Projects',
        '',
    ]

    for project in projects:
        # Clean and truncate description
        desc = project.description or ''
        desc = desc.replace('\n', ' ').strip()
        if len(desc) > 80:
            desc = desc[:77] + '...'

        # Build URL to context-md endpoint
        url = f'{base_url}/api/v1/users/{project.user.username}/projects/{project.slug}/context-md/'

        lines.append(f'- [{project.title}]({url}): {desc}')

    # Add tools directory section
    lines.append('')
    lines.append('## Tools Directory')
    lines.append('')
    lines.append(f'Browse AI tools at {base_url}/tools')
    lines.append('')
    lines.append('## Learning')
    lines.append('')
    lines.append(f'Take AI quizzes at {base_url}/learn')

    return '\n'.join(lines)

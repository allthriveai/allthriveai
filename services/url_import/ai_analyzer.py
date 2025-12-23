"""AI-powered webpage analyzer for generating structured project content.

Similar to the GitHub AI analyzer, this generates template v2 sections
for URL-imported projects to create beautiful, consistent portfolio pages.
"""

import json
import logging
import time

from services.ai import AIProvider

logger = logging.getLogger(__name__)


# Section template prompt for webpage analysis
WEBPAGE_SECTION_PROMPT = """Analyze this webpage content and generate structured sections for a portfolio project page.

URL: {url}
Title: {title}
Description: {description}
Topics/Tags: {topics}
Features: {features}
Organization: {organization}
Source Content (excerpt):
{content_excerpt}

Generate structured sections for a visually appealing project portfolio. Return valid JSON with these sections:

{{
  "overview": {{
    "headline": "One compelling sentence hook (max 100 chars)",
    "description": "2-3 sentence explanation of what this is and why it matters"
  }},
  "features": [
    {{"icon": "FaRocket", "title": "Feature Name", "description": "1-2 sentence description"}},
    ... (ALWAYS generate exactly 6 features)
  ],
  "tech_stack": {{
    "categories": [
      {{"name": "Category Name", "technologies": ["Tech1", "Tech2"]}}
    ]
  }},
  "demo": {{
    "ctas": [
      {{"label": "Visit Website", "url": "{url}", "style": "primary"}}
    ]
  }},
  "links": [],
  "category_ids": [9],
  "topics": ["topic1", "topic2"],
  "tool_names": ["Tool1", "Tool2"]
}}

IMPORTANT:
- For features: Use FontAwesome icon names (react-icons/fa format). Choose from:
  FaRocket (speed/launch), FaShieldAlt (security), FaBolt (performance/fast),
  FaCode (development), FaDatabase (data/storage), FaCog (settings/config),
  FaChartLine (analytics/growth), FaUsers (collaboration), FaLock (privacy),
  FaMobile (mobile/responsive), FaCloud (cloud), FaPlug (integrations/api),
  FaBrain (AI/ML), FaSearch (search), FaSync (sync/realtime), FaGlobe (global),
  FaClock (time/scheduling), FaFileAlt (documents), FaCheck (validation),
  FaLayerGroup (modular), FaTools (utilities), FaPalette (customization)
- For tech_stack: Only include if technologies are mentioned or inferable
- For links: ONLY include links that are EXPLICITLY present in the page content. DO NOT invent or guess URLs.
  Never add generic help pages, topic pages, or documentation that isn't specifically linked from the source.
  If no relevant links are found in the content, return an empty array.
- Category IDs: 1-15 (pick 1-2 most relevant):
  1-Chatbots, 2-Websites/Apps, 3-Design (Mockups & UI), 4-Video, 5-Education,
  6-Games, 7-Automation, 8-Productivity, 9-Developer/Coding,
  10-Prompts, 11-Experiments, 12-Wellness, 13-AI Agents, 14-AI Research, 15-Analytics
  IMPORTANT: For Figma URLs (figma.com), ALWAYS use category 3 (Design).
- Topics: lowercase, specific, 3-8 keywords
- tool_names: Only include actual AI/dev tools if mentioned (ChatGPT, Claude, etc.)

Return ONLY valid JSON, no markdown code blocks."""


def analyze_webpage_for_template(
    extracted_data: dict,
    text_content: str = '',
    user=None,
) -> dict:
    """Generate section-based template content for a webpage import.

    Args:
        extracted_data: Data extracted by the scraper (title, description, topics, etc.)
        text_content: Raw text content from the webpage
        user: Django User instance (optional, for AI usage tracking)

    Returns:
        dict with sections array and metadata for template v2 format
    """
    title = extracted_data.get('title', '')
    description = extracted_data.get('description', '')
    topics = extracted_data.get('topics', [])
    features = extracted_data.get('features', [])
    organization = extracted_data.get('organization', '')
    url = extracted_data.get('source_url', '')
    image_url = extracted_data.get('image_url', '')
    images = extracted_data.get('images', [])  # Additional images for gallery
    videos = extracted_data.get('videos', [])  # Embedded videos (YouTube, Vimeo)
    links = extracted_data.get('links', {})

    # Build prompt
    prompt = WEBPAGE_SECTION_PROMPT.format(
        url=url,
        title=title or 'Unknown',
        description=description or 'No description provided',
        topics=', '.join(topics) if topics else 'None detected',
        features=', '.join(features) if features else 'Not specified',
        organization=organization or 'Unknown',
        content_excerpt=text_content[:2000] if text_content else 'No content available',
    )

    logger.info(f'🔍 Starting template analysis for webpage: {url}')

    try:
        ai = AIProvider()
        start_time = time.time()
        response = ai.complete(
            prompt=prompt,
            model=None,
            temperature=0.7,
            max_tokens=2000,
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # Track AI usage for cost reporting
        if user and ai.last_usage:
            from core.ai_usage.tracker import AIUsageTracker

            usage = ai.last_usage
            AIUsageTracker.track_usage(
                user=user,
                feature='webpage_template_analysis',
                provider=ai.current_provider,
                model=ai.current_model,
                input_tokens=usage.get('prompt_tokens', 0),
                output_tokens=usage.get('completion_tokens', 0),
                latency_ms=latency_ms,
                status='success',
            )

        logger.info(f'✅ Template AI response received for {url}')

        # Clean response - remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith('```'):
            clean_response = clean_response.split('\n', 1)[1]
        if clean_response.endswith('```'):
            clean_response = clean_response.rsplit('```', 1)[0]
        clean_response = clean_response.strip()

        result = json.loads(clean_response)

        # Build sections array from AI response
        sections = []
        section_order = 0

        # Overview section
        if result.get('overview'):
            overview = result['overview']
            overview_content = {
                'headline': overview.get('headline', ''),
                'description': overview.get('description', description or ''),
            }
            if image_url:
                overview_content['previewImage'] = image_url

            sections.append(
                {
                    'id': f'section-overview-{hash(url) % 10000}',
                    'type': 'overview',
                    'enabled': True,
                    'order': section_order,
                    'content': overview_content,
                }
            )
            section_order += 1

        # Features section
        if result.get('features') and len(result['features']) > 0:
            sections.append(
                {
                    'id': f'section-features-{hash(url) % 10000}',
                    'type': 'features',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'features': result['features'][:6],
                    },
                }
            )
            section_order += 1

        # Demo section (CTAs to visit website)
        demo_ctas = result.get('demo', {}).get('ctas', [])
        if not demo_ctas:
            # Default CTA if none provided
            demo_ctas = [{'label': 'Visit Website', 'url': url, 'style': 'primary'}]

        sections.append(
            {
                'id': f'section-demo-{hash(url) % 10000}',
                'type': 'demo',
                'enabled': True,
                'order': section_order,
                'content': {
                    'ctas': demo_ctas,
                },
            }
        )
        section_order += 1

        # Video section (if we have embedded videos from the page)
        if videos and len(videos) > 0:
            # Use the first video as the primary video
            primary_video = videos[0]
            sections.append(
                {
                    'id': f'section-video-{hash(url) % 10000}',
                    'type': 'video',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'url': primary_video.get('url', ''),
                        'embed_url': primary_video.get('embed_url', ''),
                        'platform': primary_video.get('platform', 'youtube'),
                        'video_id': primary_video.get('video_id', ''),
                        'thumbnail': primary_video.get('thumbnail', ''),
                    },
                }
            )
            section_order += 1

        # Gallery section (if we have images from the page)
        if images and len(images) > 0:
            gallery_images = [
                {'url': img.get('url', ''), 'alt': img.get('alt', '')} for img in images if img.get('url')
            ]
            if gallery_images:
                sections.append(
                    {
                        'id': f'section-gallery-{hash(url) % 10000}',
                        'type': 'gallery',
                        'enabled': True,
                        'order': section_order,
                        'content': {
                            'images': gallery_images,
                            'layout': 'masonry',
                        },
                    }
                )
                section_order += 1

        # Tech stack section
        if result.get('tech_stack', {}).get('categories'):
            sections.append(
                {
                    'id': f'section-tech-{hash(url) % 10000}',
                    'type': 'tech_stack',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'categories': result['tech_stack']['categories'],
                    },
                }
            )
            section_order += 1

        # Links section
        ai_links = result.get('links', [])
        # Merge with extracted links
        if links:
            for label, link_url in links.items():
                if link_url and not any(lnk.get('url') == link_url for lnk in ai_links):
                    ai_links.append(
                        {
                            'label': label.title(),
                            'url': link_url,
                            'icon': _get_icon_for_link(label),
                        }
                    )

        if ai_links:
            sections.append(
                {
                    'id': f'section-links-{hash(url) % 10000}',
                    'type': 'links',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'links': ai_links,
                    },
                }
            )
            section_order += 1

        # Validate metadata
        validated = {
            'templateVersion': 2,
            'sections': sections,
            'description': result.get('overview', {}).get('description', description or ''),
            'category_ids': [],
            'topics': [],
            'tool_names': [],
            'hero_image': image_url,
        }

        # Validate category_ids
        if 'category_ids' in result and isinstance(result['category_ids'], list):
            validated['category_ids'] = [
                int(c) for c in result['category_ids'] if isinstance(c, int | str) and 1 <= int(c) <= 15
            ][:3]

        # Validate topics
        if 'topics' in result and isinstance(result['topics'], list):
            validated['topics'] = [str(t).lower()[:50] for t in result['topics'] if t and isinstance(t, str)][:10]

        # Merge with extracted topics
        if topics:
            for t in topics:
                if t.lower() not in validated['topics']:
                    validated['topics'].append(t.lower())
            validated['topics'] = validated['topics'][:10]

        # Validate tool_names
        if 'tool_names' in result and isinstance(result['tool_names'], list):
            validated['tool_names'] = [str(t) for t in result['tool_names'] if t and isinstance(t, str)][:5]

        logger.info(f'✅ Template analysis complete for {url}: {len(sections)} sections generated')
        return validated

    except json.JSONDecodeError as e:
        logger.warning(f'AI returned invalid JSON for {url}: {e}')
    except Exception as e:
        logger.error(f'Template analysis error for {url}: {e}', exc_info=True)

    # Fallback: Generate basic sections from extracted data
    logger.info(f'📦 Using fallback template generation for {url}')
    return _generate_fallback_template(extracted_data, url, image_url, images)


def _generate_fallback_template(
    extracted_data: dict,
    url: str,
    image_url: str,
    images: list | None = None,
) -> dict:
    """Generate fallback template sections when AI fails."""
    title = extracted_data.get('title', 'Imported Project')
    description = extracted_data.get('description', '')
    topics = extracted_data.get('topics', [])
    features = extracted_data.get('features', [])
    links = extracted_data.get('links', {})
    images = images or []

    sections = []
    section_order = 0

    # Overview section
    overview_content = {
        'headline': title,
        'description': description or 'An imported project from the web.',
    }
    if image_url:
        overview_content['previewImage'] = image_url

    sections.append(
        {
            'id': f'section-overview-{hash(url) % 10000}',
            'type': 'overview',
            'enabled': True,
            'order': section_order,
            'content': overview_content,
        }
    )
    section_order += 1

    # Features section (from extracted features)
    if features:
        feature_items = [{'icon': 'FaCheck', 'title': f, 'description': ''} for f in features[:6]]
        sections.append(
            {
                'id': f'section-features-{hash(url) % 10000}',
                'type': 'features',
                'enabled': True,
                'order': section_order,
                'content': {'features': feature_items},
            }
        )
        section_order += 1

    # Demo section
    sections.append(
        {
            'id': f'section-demo-{hash(url) % 10000}',
            'type': 'demo',
            'enabled': True,
            'order': section_order,
            'content': {
                'ctas': [{'label': 'Visit Website', 'url': url, 'style': 'primary'}],
            },
        }
    )
    section_order += 1

    # Gallery section (if we have images)
    if images and len(images) > 0:
        gallery_images = [{'url': img.get('url', ''), 'alt': img.get('alt', '')} for img in images if img.get('url')]
        if gallery_images:
            sections.append(
                {
                    'id': f'section-gallery-{hash(url) % 10000}',
                    'type': 'gallery',
                    'enabled': True,
                    'order': section_order,
                    'content': {
                        'images': gallery_images,
                        'layout': 'masonry',
                    },
                }
            )
            section_order += 1

    # Links section
    if links:
        link_items = [
            {'label': label.title(), 'url': link_url, 'icon': _get_icon_for_link(label)}
            for label, link_url in links.items()
            if link_url
        ]
        if link_items:
            sections.append(
                {
                    'id': f'section-links-{hash(url) % 10000}',
                    'type': 'links',
                    'enabled': True,
                    'order': section_order,
                    'content': {'links': link_items},
                }
            )
            section_order += 1

    return {
        'templateVersion': 2,
        'sections': sections,
        'description': description or 'An imported project.',
        'category_ids': [],
        'topics': [t.lower() for t in topics[:10]] if topics else [],
        'tool_names': [],
        'hero_image': image_url,
    }


def _get_icon_for_link(label: str) -> str:
    """Get appropriate icon for a link based on its label."""
    label_lower = label.lower()
    icon_map = {
        'github': 'github',
        'docs': 'book',
        'documentation': 'book',
        'demo': 'external',
        'twitter': 'twitter',
        'discord': 'message',
        'blog': 'file-text',
        'npm': 'package',
        'pypi': 'package',
    }
    return icon_map.get(label_lower, 'external')

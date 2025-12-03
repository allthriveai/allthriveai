"""
Constants used across the AllThrive AI application.

This module contains API endpoints, common strings, and other constants
to follow DRY principles and centralize configuration.
"""

# API Endpoints - Base paths
API_BASE = '/api/v1'

# API Endpoints - Integrations
INTEGRATIONS_IMPORT_URL = f'{API_BASE}/integrations/import-from-url/'

# API Endpoints - Referrals
REFERRAL_CODE_UPDATE_URL = f'{API_BASE}/me/referral-code/update_code/'
REFERRAL_CODE_STATS_URL = f'{API_BASE}/me/referral-code/stats/'
REFERRAL_VALIDATE_URL = f'{API_BASE}/referrals/validate/'

# API Endpoints - Projects
PROJECTS_BASE_URL = f'{API_BASE}/me/projects/'

# Mock paths for testing
MOCK_PATHS = {
    'base_parser_optimize': 'core.integrations.base.parser.BaseParser.optimize_content',
    'base_parser_transform': 'core.integrations.base.parser.BaseParser.transform_content',
    'base_parser_parse': 'core.integrations.base.parser.BaseParser.parse',
    'base_parser_scan': 'core.integrations.base.parser.BaseParser.scan_repository',
    'base_parser_generate_diagram': 'core.integrations.base.parser.BaseParser.generate_architecture_diagram',
    'youtube_service_get_channel': 'core.integrations.youtube.service.YouTubeService.get_channel',
    'intent_detection_ai_provider': 'core.agents.intent_detection.AIProvider',
    'intent_detection_cache': 'core.agents.intent_detection.cache',
    'intent_get_service': 'core.agents.views.get_intent_service',
}

# Feature names for billing
FEATURE_NAMES = {
    'marketplace': 'Marketplace',
    'go1_courses': 'Go1 Courses',
    'ai_mentor': 'AI Mentor',
}

# Architecture diagram constants
ARCHITECTURE_DIAGRAM_TITLE = 'Project architecture and component relationships'

# Test repository URLs
TEST_REPO_URL = 'https://github.com/test/repo'

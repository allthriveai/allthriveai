"""Celery tasks for project-related background processing."""

import asyncio
import logging

from celery import shared_task
from django.utils import timezone

from core.projects.models import Project
from services.analyzers.factory import AnalyzerFactory

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def analyze_project_with_mcp(self, project_id: int):
    """
    Background task to analyze project using MCP-based analyzers.

    Note: GitHub projects are imported with full analysis via the Create Project Agent
    (import_github_project tool). This task is only used for background analysis of
    other project types.

    Currently supported for background analysis:
    - Figma designs (via Figma MCP Server)

    Analysis includes:
    - Project metadata and structure
    - Source-specific insights
    - AI-generated visualizations

    Args:
        project_id: ID of the project to analyze

    Returns:
        Dictionary with status and project_id
    """
    try:
        project = Project.objects.get(id=project_id)

        # Check if project type is analyzable
        if not AnalyzerFactory.is_analyzable(project):
            logger.warning(f'Project {project_id} type {project.type} is not analyzable')
            return {'status': 'error', 'error': f'Project type {project.type} does not support analysis'}

        logger.info(f'Starting MCP analysis for project {project_id} ({project.type})')

        # Create appropriate analyzer for project type
        analyzer = AnalyzerFactory.create_analyzer(project)

        # Validate source accessibility before running full analysis
        is_valid, error_msg = asyncio.run(analyzer.validate_source())
        if not is_valid:
            logger.error(f'Source validation failed for project {project_id}: {error_msg}')
            content = project.content or {}
            content_key = analyzer.get_content_key()
            if content_key not in content:
                content[content_key] = {}
            content[content_key]['analysis_status'] = 'failed'
            content[content_key]['analysis_error'] = error_msg
            content[content_key]['failed_at'] = timezone.now().isoformat()
            project.content = content
            project.save(update_fields=['content'])
            return {'status': 'error', 'error': error_msg}

        # Run analysis using async analyzer
        analysis_result = asyncio.run(analyzer.analyze())

        # Store results in project.content under source-specific key
        content = project.content or {}
        content_key = analyzer.get_content_key()

        if content_key not in content:
            content[content_key] = {}

        if analysis_result['status'] == 'success':
            content[content_key]['analysis'] = analysis_result['data']
            content[content_key]['analyzed_at'] = analysis_result['analyzed_at']
            content[content_key]['analysis_status'] = 'complete'
        else:
            content[content_key]['analysis_status'] = 'failed'
            content[content_key]['analysis_error'] = analysis_result.get('error', 'Unknown error')
            content[content_key]['failed_at'] = analysis_result['analyzed_at']

        project.content = content
        project.save(update_fields=['content', 'updated_at'])

        logger.info(
            f'Successfully analyzed project {project_id} ({analyzer.get_source_identifier()}) '
            f'- Status: {analysis_result["status"]}'
        )

        return {'status': 'success', 'project_id': project_id, 'source': analyzer.get_source_identifier()}

    except Project.DoesNotExist:
        logger.error(f'Project {project_id} not found')
        return {'status': 'error', 'error': 'Project not found'}

    except ValueError as e:
        # Invalid project configuration (e.g., no URL, unsupported type)
        logger.error(f'Invalid project configuration for {project_id}: {e}')
        return {'status': 'error', 'error': str(e)}

    except Exception as e:
        logger.error(f'MCP analysis failed for project {project_id}: {e}', exc_info=True)

        # Mark as failed in project content
        try:
            project = Project.objects.get(id=project_id)
            analyzer = AnalyzerFactory.create_analyzer(project)
            content = project.content or {}
            content_key = analyzer.get_content_key()

            if content_key not in content:
                content[content_key] = {}

            content[content_key]['analysis_status'] = 'failed'
            content[content_key]['analysis_error'] = str(e)
            content[content_key]['failed_at'] = timezone.now().isoformat()
            project.content = content
            project.save(update_fields=['content'])
        except Exception as save_error:
            logger.error(f'Failed to update project status: {save_error}')

        # Retry with exponential backoff
        countdown = 60 * (2**self.request.retries)
        logger.info(f'Retrying in {countdown} seconds (attempt {self.request.retries + 1}/3)')
        raise self.retry(exc=e, countdown=countdown) from e

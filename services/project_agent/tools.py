"""
LangChain tools for project creation agent.
"""
import logging
import requests
from typing import Optional
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from services.project_service import ProjectService
from tenacity import retry, stop_after_attempt, wait_exponential
from django.core.cache import cache

logger = logging.getLogger(__name__)


# Tool Input Schemas
class CreateProjectInput(BaseModel):
    """Input for create_project tool."""
    title: str = Field(description="The title/name of the project")
    project_type: str = Field(description="Type of project: github_repo, image_collection, prompt, or other")
    description: str = Field(default="", description="Description of the project (optional)")
    is_showcase: bool = Field(default=False, description="Whether to add to showcase (optional)")


class FetchGitHubMetadataInput(BaseModel):
    """Input for fetch_github_metadata tool."""
    url: str = Field(description="GitHub repository URL (e.g., https://github.com/user/repo)")


class ExtractURLInfoInput(BaseModel):
    """Input for extract_url_info tool."""
    text: str = Field(description="Text that may contain URLs")


# Tools
@tool(args_schema=CreateProjectInput)
def create_project(
    title: str,
    project_type: str,
    description: str = "",
    is_showcase: bool = False,
    config: Optional[RunnableConfig] = None
) -> dict:
    """
    Create a new project for the user.
    
    Use this tool when the user has provided all necessary information
    and confirmed they want to create the project.
    
    Returns:
        Dictionary with project details or error message
    """
    # Get user_id from config context
    if not config or "user_id" not in config.get("configurable", {}):
        return {"success": False, "error": "User not authenticated"}
    
    user_id = config["configurable"]["user_id"]
    
    # Create project via service
    project, error = ProjectService.create_project(
        user_id=user_id,
        title=title,
        project_type=project_type,
        description=description,
        is_showcase=is_showcase
    )
    
    if error:
        return {
            "success": False,
            "error": error
        }
    
    return {
        "success": True,
        "project_id": project.id,
        "slug": project.slug,
        "title": project.title,
        "url": f"/{project.user.username}/{project.slug}",
        "message": f"Project '{project.title}' created successfully!"
    }


@tool(args_schema=FetchGitHubMetadataInput)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def fetch_github_metadata(url: str) -> dict:
    """
    Fetch metadata from a GitHub repository URL.
    
    Use this tool when the user provides a GitHub repository link
    and you want to auto-generate project information.
    
    Returns:
        Dictionary with repository metadata or error message
    """
    # Validate GitHub URL
    if not ProjectService.is_github_url(url):
        return {"success": False, "error": "Invalid GitHub URL"}
    
    # Cache key for this repo
    cache_key = f"project_agent:github:{url}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    try:
        # Extract owner and repo from URL
        # Example: https://github.com/owner/repo
        parts = url.rstrip('/').split('/')
        if len(parts) < 5:
            return {"success": False, "error": "Invalid GitHub URL format"}
        
        owner = parts[-2]
        repo = parts[-1]
        
        # Fetch from GitHub API with authentication if available
        from django.conf import settings
        
        api_url = f"https://api.github.com/repos/{owner}/{repo}"
        headers = {}
        
        github_token = getattr(settings, 'GITHUB_API_TOKEN', None)
        if github_token:
            headers['Authorization'] = f'token {github_token}'
            
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 404:
            return {"success": False, "error": "Repository not found"}
        
        if response.status_code != 200:
            return {"success": False, "error": f"GitHub API error: {response.status_code}"}
        
        data = response.json()
        
        result = {
            "success": True,
            "title": data.get("name", ""),
            "description": data.get("description", ""),
            "language": data.get("language", ""),
            "stars": data.get("stargazers_count", 0),
            "forks": data.get("forks_count", 0),
            "topics": data.get("topics", []),
            "homepage": data.get("homepage", ""),
            "project_type": "github_repo"
        }
        
        # Cache successful result for 1 hour
        cache.set(cache_key, result, 3600)
        return result
        
    except requests.RequestException as e:
        logger.error(f"Error fetching GitHub metadata: {e}")
        return {"success": False, "error": f"Failed to fetch repository data: {str(e)}"}
    except Exception as e:
        logger.error(f"Unexpected error in fetch_github_metadata: {e}", exc_info=True)
        return {"success": False, "error": "An unexpected error occurred"}


@tool(args_schema=ExtractURLInfoInput)
def extract_url_info(text: str) -> dict:
    """
    Extract and analyze URLs from user input text.
    
    Use this tool when the user's message might contain links
    and you want to detect and categorize them.
    
    Returns:
        Dictionary with extracted URLs and inferred information
    """
    urls = ProjectService.extract_urls_from_text(text)
    
    if not urls:
        return {
            "success": True,
            "has_urls": False,
            "urls": [],
            "message": "No URLs found in text"
        }
    
    # Analyze first URL
    first_url = urls[0]
    inferred_type = ProjectService.infer_project_type_from_url(first_url)
    is_github = ProjectService.is_github_url(first_url)
    
    return {
        "success": True,
        "has_urls": True,
        "urls": urls,
        "first_url": first_url,
        "is_github": is_github,
        "inferred_type": inferred_type,
        "message": f"Found {len(urls)} URL(s)" + (", including a GitHub repository" if is_github else "")
    }


# Tool list for agent
PROJECT_TOOLS = [
    create_project,
    fetch_github_metadata,
    extract_url_info
]

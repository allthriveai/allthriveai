"""
GitHub Repository Analyzer Service
Analyzes GitHub repositories to extract tech stack, architecture, and project structure.
"""

import json
import logging
from typing import Any

import yaml
from github import Github, GithubException, UnknownObjectException
from github.Repository import Repository

from services.ai import AIProvider

logger = logging.getLogger(__name__)


class GitHubRepositoryAnalyzer:
    """
    Analyzes GitHub repositories to extract comprehensive project information.

    Features:
    - Tech stack detection from dependency files
    - Project type identification (fullstack, frontend, backend, library)
    - Directory tree generation
    - AI-powered architecture diagram generation
    - Quick start command extraction
    """

    def __init__(self, repo_full_name: str, github_token: str | None = None):
        """
        Initialize the analyzer.

        Args:
            repo_full_name: Repository in format "owner/repo"
            github_token: GitHub access token for API access
        """
        self.repo_full_name = repo_full_name
        self.github = Github(github_token) if github_token else Github()
        self.repo: Repository | None = None
        self.ai_provider = AIProvider()

    def analyze_repository(self) -> dict[str, Any]:
        """
        Main analysis method that orchestrates all analysis tasks.

        Returns:
            Dictionary containing analysis results with keys:
            - tech_stack: Detected technologies categorized
            - project_type: Type of project (fullstack, frontend, backend, library)
            - architecture_diagram: Mermaid diagram code
            - directory_tree: Repository structure
            - quick_start: Installation and dev commands
            - features_discovered: Detected features with file references
        """
        try:
            self.repo = self.github.get_repo(self.repo_full_name)
        except (GithubException, UnknownObjectException) as e:
            logger.error(f'Failed to fetch repository {self.repo_full_name}: {e}')
            raise

        logger.info(f'Analyzing repository: {self.repo_full_name}')

        # Run all analysis tasks
        tech_stack = self._detect_tech_stack()
        project_type = self._detect_project_type(tech_stack)
        directory_tree = self._fetch_directory_tree()
        architecture_diagram = self._generate_architecture_diagram(tech_stack)
        quick_start = self._extract_quick_start()
        features_discovered = self._discover_features(tech_stack)

        return {
            'tech_stack': tech_stack,
            'project_type': project_type,
            'architecture_diagram': architecture_diagram,
            'directory_tree': directory_tree,
            'quick_start': quick_start,
            'features_discovered': features_discovered,
        }

    def _fetch_file(self, path: str) -> str | None:
        """
        Fetch a single file from the repository.

        Args:
            path: File path in repository

        Returns:
            File content as string, or None if not found
        """
        try:
            content_file = self.repo.get_contents(path)
            if isinstance(content_file, list):
                # If it's a directory, return None
                return None
            return content_file.decoded_content.decode('utf-8')
        except (UnknownObjectException, GithubException):
            return None

    def _detect_tech_stack(self) -> dict[str, list[str]]:
        """
        Parse dependency files to extract tech stack.

        Returns:
            Dictionary with categories: frontend, backend, databases, infrastructure, testing
        """
        stack = {
            'frontend': [],
            'backend': [],
            'databases': [],
            'infrastructure': [],
            'testing': [],
        }

        # Check package.json (JavaScript/TypeScript/Node.js)
        package_json = self._fetch_file('package.json')
        if package_json:
            self._parse_package_json(package_json, stack)

        # Check requirements.txt (Python)
        requirements = self._fetch_file('requirements.txt')
        if requirements:
            self._parse_requirements_txt(requirements, stack)

        # Check pyproject.toml (Python)
        pyproject = self._fetch_file('pyproject.toml')
        if pyproject:
            self._parse_pyproject_toml(pyproject, stack)

        # Check go.mod (Go)
        go_mod = self._fetch_file('go.mod')
        if go_mod:
            self._parse_go_mod(go_mod, stack)

        # Check Cargo.toml (Rust)
        cargo_toml = self._fetch_file('Cargo.toml')
        if cargo_toml:
            self._parse_cargo_toml(cargo_toml, stack)

        # Check Gemfile (Ruby)
        gemfile = self._fetch_file('Gemfile')
        if gemfile:
            self._parse_gemfile(gemfile, stack)

        # Check composer.json (PHP)
        composer_json = self._fetch_file('composer.json')
        if composer_json:
            self._parse_composer_json(composer_json, stack)

        # Check docker-compose.yml (Infrastructure & Databases)
        docker_compose = self._fetch_file('docker-compose.yml')
        if not docker_compose:
            docker_compose = self._fetch_file('docker-compose.yaml')
        if docker_compose:
            self._parse_docker_compose(docker_compose, stack)

        # Check Dockerfile
        dockerfile = self._fetch_file('Dockerfile')
        if dockerfile:
            if 'Docker' not in stack['infrastructure']:
                stack['infrastructure'].append('Docker')

        # Remove empty categories and duplicates
        return {k: list(set(v)) for k, v in stack.items() if v}

    def _parse_package_json(self, content: str, stack: dict):
        """Parse package.json for frontend/backend technologies."""
        try:
            data = json.loads(content)
            deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}

            # Frontend frameworks
            if 'react' in deps:
                stack['frontend'].append('React')
            if 'vue' in deps:
                stack['frontend'].append('Vue')
            if 'next' in deps:
                stack['frontend'].append('Next.js')
            if '@angular/core' in deps:
                stack['frontend'].append('Angular')
            if 'svelte' in deps:
                stack['frontend'].append('Svelte')

            # TypeScript
            if 'typescript' in deps:
                stack['frontend'].append('TypeScript')

            # Styling
            if 'tailwindcss' in deps:
                stack['frontend'].append('Tailwind CSS')
            if 'sass' in deps or 'node-sass' in deps:
                stack['frontend'].append('Sass')

            # Backend frameworks
            if 'express' in deps:
                stack['backend'].append('Express.js')
            if 'fastify' in deps:
                stack['backend'].append('Fastify')
            if 'koa' in deps:
                stack['backend'].append('Koa')

            # Testing
            if 'jest' in deps:
                stack['testing'].append('Jest')
            if 'vitest' in deps:
                stack['testing'].append('Vitest')
            if 'cypress' in deps:
                stack['testing'].append('Cypress')
            if 'playwright' in deps:
                stack['testing'].append('Playwright')
            if '@testing-library/react' in deps:
                stack['testing'].append('React Testing Library')

        except json.JSONDecodeError:
            logger.warning('Failed to parse package.json')

    def _parse_requirements_txt(self, content: str, stack: dict):
        """Parse requirements.txt for Python packages."""
        content_lower = content.lower()

        # Backend frameworks
        if 'django' in content_lower:
            stack['backend'].append('Django')
        if 'flask' in content_lower:
            stack['backend'].append('Flask')
        if 'fastapi' in content_lower:
            stack['backend'].append('FastAPI')

        # Databases
        if 'psycopg' in content_lower:
            stack['databases'].append('PostgreSQL')
        if 'pymongo' in content_lower:
            stack['databases'].append('MongoDB')
        if 'mysqlclient' in content_lower or 'pymysql' in content_lower:
            stack['databases'].append('MySQL')
        if 'redis' in content_lower:
            stack['databases'].append('Redis')

        # Task queues
        if 'celery' in content_lower:
            stack['infrastructure'].append('Celery')
        if 'rq' in content_lower:
            stack['infrastructure'].append('Redis Queue')

        # Testing
        if 'pytest' in content_lower:
            stack['testing'].append('pytest')

        stack['backend'].append('Python')

    def _parse_pyproject_toml(self, content: str, stack: dict):
        """Parse pyproject.toml for Python dependencies."""
        # Similar to requirements.txt but TOML format
        content_lower = content.lower()

        if 'django' in content_lower and 'Django' not in stack['backend']:
            stack['backend'].append('Django')
        if 'flask' in content_lower and 'Flask' not in stack['backend']:
            stack['backend'].append('Flask')
        if 'fastapi' in content_lower and 'FastAPI' not in stack['backend']:
            stack['backend'].append('FastAPI')

    def _parse_go_mod(self, content: str, stack: dict):
        """Parse go.mod for Go dependencies."""
        stack['backend'].append('Go')

        if 'gin-gonic/gin' in content:
            stack['backend'].append('Gin')
        if 'gofiber/fiber' in content:
            stack['backend'].append('Fiber')
        if 'labstack/echo' in content:
            stack['backend'].append('Echo')

    def _parse_cargo_toml(self, content: str, stack: dict):
        """Parse Cargo.toml for Rust dependencies."""
        stack['backend'].append('Rust')

        if 'actix-web' in content:
            stack['backend'].append('Actix Web')
        if 'rocket' in content:
            stack['backend'].append('Rocket')
        if 'axum' in content:
            stack['backend'].append('Axum')

    def _parse_gemfile(self, content: str, stack: dict):
        """Parse Gemfile for Ruby dependencies."""
        stack['backend'].append('Ruby')

        if 'rails' in content.lower():
            stack['backend'].append('Ruby on Rails')
        if 'sinatra' in content.lower():
            stack['backend'].append('Sinatra')

    def _parse_composer_json(self, content: str, stack: dict):
        """Parse composer.json for PHP dependencies."""
        try:
            data = json.loads(content)
            stack['backend'].append('PHP')

            require = data.get('require', {})
            if 'laravel/framework' in require:
                stack['backend'].append('Laravel')
            if 'symfony/symfony' in require or 'symfony/framework-bundle' in require:
                stack['backend'].append('Symfony')

        except json.JSONDecodeError:
            logger.warning('Failed to parse composer.json')

    def _parse_docker_compose(self, content: str, stack: dict):
        """Parse docker-compose.yml for services and databases."""
        try:
            data = yaml.safe_load(content)
            services = data.get('services', {})

            for _service_name, service_config in services.items():
                image = service_config.get('image', '').lower()

                # Databases
                if 'postgres' in image or 'postgresql' in image:
                    if 'PostgreSQL' not in stack['databases']:
                        stack['databases'].append('PostgreSQL')
                if 'mongo' in image:
                    if 'MongoDB' not in stack['databases']:
                        stack['databases'].append('MongoDB')
                if 'mysql' in image or 'mariadb' in image:
                    if 'MySQL' not in stack['databases']:
                        stack['databases'].append('MySQL')
                if 'redis' in image:
                    if 'Redis' not in stack['databases']:
                        stack['databases'].append('Redis')

                # Infrastructure
                if 'nginx' in image:
                    stack['infrastructure'].append('Nginx')
                if 'caddy' in image:
                    stack['infrastructure'].append('Caddy')
                if 'traefik' in image:
                    stack['infrastructure'].append('Traefik')

            if services:
                stack['infrastructure'].append('Docker Compose')

        except yaml.YAMLError:
            logger.warning('Failed to parse docker-compose.yml')

    def _detect_project_type(self, tech_stack: dict) -> str:
        """
        Detect project architecture type.

        Returns:
            One of: fullstack, frontend, backend, library, cli, mobile
        """
        has_frontend = bool(tech_stack.get('frontend'))
        has_backend = bool(tech_stack.get('backend'))

        if has_frontend and has_backend:
            return 'fullstack'
        elif has_frontend:
            return 'frontend'
        elif has_backend:
            # Check if it's a library or API
            if self._fetch_file('setup.py') or self._fetch_file('pyproject.toml'):
                return 'library'
            return 'backend'
        else:
            return 'other'

    def _fetch_directory_tree(self, max_depth: int = 3) -> dict:
        """
        Get repository directory structure.

        Args:
            max_depth: Maximum depth to traverse

        Returns:
            Nested dictionary representing directory tree
        """
        try:
            contents = self.repo.get_contents('')
            tree = self._build_tree(contents, current_depth=0, max_depth=max_depth)
            return tree
        except Exception as e:
            logger.error(f'Failed to fetch directory tree: {e}')
            return {}

    def _build_tree(self, contents, current_depth: int, max_depth: int) -> dict:
        """Recursively build directory tree."""
        if current_depth >= max_depth:
            return {}

        tree = {'name': 'root', 'type': 'directory', 'children': []}

        for item in contents:
            if item.type == 'dir':
                # Skip common directories to reduce noise
                if item.name in ['.git', 'node_modules', '__pycache__', 'venv', '.venv', 'dist', 'build']:
                    continue

                node = {'name': item.name, 'type': 'directory', 'children': []}

                # Recursively get subdirectory contents
                if current_depth < max_depth - 1:
                    try:
                        sub_contents = self.repo.get_contents(item.path)
                        if isinstance(sub_contents, list):
                            for sub_item in sub_contents:
                                if sub_item.type == 'dir':
                                    node['children'].append(
                                        {'name': sub_item.name, 'type': 'directory', 'children': []}
                                    )
                                else:
                                    node['children'].append({'name': sub_item.name, 'type': 'file'})
                    except Exception as e:
                        logger.warning(f'Failed to fetch subdirectory contents: {e}')

                tree['children'].append(node)
            else:
                tree['children'].append({'name': item.name, 'type': 'file'})

        return tree

    def _generate_architecture_diagram(self, tech_stack: dict) -> str | None:
        """
        Generate Mermaid architecture diagram using AI.

        Args:
            tech_stack: Detected technologies

        Returns:
            Mermaid diagram code or None
        """
        # First try to generate from docker-compose.yml (most accurate)
        docker_compose = self._fetch_file('docker-compose.yml')
        if not docker_compose:
            docker_compose = self._fetch_file('docker-compose.yaml')

        if docker_compose:
            diagram = self._diagram_from_docker_compose(docker_compose)
            if diagram:
                return diagram

        # Get directory structure for better context
        directory_tree = self.get_directory_tree(max_depth=2)

        # Fallback: Use AI to generate from tech stack + directory structure
        return self._diagram_from_structure(tech_stack, directory_tree)

    def _diagram_from_docker_compose(self, docker_compose_content: str) -> str | None:
        """Generate Mermaid diagram from docker-compose.yml using AI."""
        try:
            system_message = """You are an expert at creating Mermaid architecture diagrams.
Generate a clean, professional Mermaid diagram (graph TD format) from the docker-compose.yml content.
Show services, their relationships, and data flow.
Use clear node labels and appropriate arrows.
Return ONLY the Mermaid code, no explanation."""

            prompt = f"""Create a Mermaid architecture diagram from this docker-compose.yml:

```yaml
{docker_compose_content}
```

Return only the Mermaid code."""

            diagram = self.ai_provider.complete(
                prompt=prompt, system_message=system_message, temperature=0.3, max_tokens=1000
            )

            # Clean up the response (remove markdown code blocks if present)
            diagram = diagram.strip()
            if diagram.startswith('```mermaid'):
                diagram = diagram[10:]
            if diagram.startswith('```'):
                diagram = diagram[3:]
            if diagram.endswith('```'):
                diagram = diagram[:-3]

            return diagram.strip()

        except Exception as e:
            logger.error(f'Failed to generate diagram from docker-compose: {e}')
            return None

    def _diagram_from_tech_stack(self, tech_stack: dict) -> str | None:
        """Generate Mermaid diagram from tech stack using AI (deprecated, use _diagram_from_structure)."""
        return self._diagram_from_structure(tech_stack, None)

    def _format_directory_tree(self, tree: dict, indent: int = 0) -> str:
        """Format directory tree as a readable string for the AI prompt."""
        if not tree:
            return ''

        lines = []
        prefix = '  ' * indent

        if indent == 0 and tree.get('name'):
            lines.append(f'{tree["name"]}/')

        for child in tree.get('children', []):
            if child.get('type') == 'directory':
                lines.append(f'{prefix}{child["name"]}/')
                # Recursively format children
                for subchild in child.get('children', []):
                    if subchild.get('type') == 'directory':
                        lines.append(f'{prefix}  {subchild["name"]}/')
                    else:
                        lines.append(f'{prefix}  {subchild["name"]}')
            else:
                lines.append(f'{prefix}{child["name"]}')

        return '\n'.join(lines)

    def _diagram_from_structure(self, tech_stack: dict, directory_tree: dict | None) -> str | None:
        """Generate Mermaid diagram from tech stack AND directory structure using AI."""
        try:
            system_message = """You are an expert at creating accurate Mermaid architecture diagrams.
Your task is to analyze the ACTUAL project structure and create a diagram that reflects what the code really does.

IMPORTANT RULES:
1. Base your diagram on the ACTUAL directory structure and files, not generic patterns
2. Identify real components from folder names (e.g., 'api/', 'models/', 'services/', 'handlers/')
3. Show data flow between actual components
4. Use graph TD (top-down) format
5. Keep it simple: 4-8 nodes maximum
6. Use descriptive labels based on actual folder/file names
7. Return ONLY the Mermaid code, no explanation

Example for a project with src/api/, src/models/, src/services/:
graph TD
    A[API Routes] --> B[Services]
    B --> C[Models]
    C --> D[Database]"""

            stack_description = json.dumps(tech_stack, indent=2) if tech_stack else 'Unknown'

            # Format directory tree for the prompt
            tree_description = ''
            if directory_tree:
                tree_description = self._format_directory_tree(directory_tree)

            prompt = f"""Analyze this project's ACTUAL structure and create an accurate Mermaid architecture diagram.

PROJECT DIRECTORY STRUCTURE:
{tree_description if tree_description else 'Not available'}

TECH STACK:
{stack_description}

Based on the directory structure above, identify the main components and their relationships.
Look for patterns like:
- api/, routes/, handlers/ = API layer
- services/, controllers/, logic/ = Business logic
- models/, entities/, schemas/ = Data models
- db/, database/, repositories/ = Data access
- utils/, helpers/, common/ = Utilities
- frontend/, client/, web/ = Frontend
- worker/, jobs/, tasks/ = Background processing

Create a diagram showing how these ACTUAL components connect.
Return only the Mermaid code starting with "graph TD"."""

            diagram = self.ai_provider.complete(
                prompt=prompt, system_message=system_message, temperature=0.3, max_tokens=1000
            )

            # Clean up the response
            diagram = diagram.strip()
            if diagram.startswith('```mermaid'):
                diagram = diagram[10:]
            if diagram.startswith('```'):
                diagram = diagram[3:]
            if diagram.endswith('```'):
                diagram = diagram[:-3]

            return diagram.strip()

        except Exception as e:
            logger.error(f'Failed to generate diagram from structure: {e}')
            return None

    def _extract_quick_start(self) -> list[dict]:
        """
        Extract installation and development commands.

        Returns:
            List of command dictionaries with 'label' and 'command' keys
        """
        commands = []

        # Check package.json scripts
        package_json = self._fetch_file('package.json')
        if package_json:
            try:
                data = json.loads(package_json)
                scripts = data.get('scripts', {})

                # Common script patterns
                if 'install' in scripts:
                    commands.append({'label': 'Install Dependencies', 'command': 'npm install'})
                elif package_json:
                    commands.append({'label': 'Install Dependencies', 'command': 'npm install'})

                if 'dev' in scripts:
                    commands.append({'label': 'Start Dev Server', 'command': 'npm run dev'})
                elif 'start' in scripts:
                    commands.append({'label': 'Start Application', 'command': 'npm start'})

                if 'build' in scripts:
                    commands.append({'label': 'Build for Production', 'command': 'npm run build'})

                if 'test' in scripts:
                    commands.append({'label': 'Run Tests', 'command': 'npm test'})

            except json.JSONDecodeError:
                pass

        # Check Makefile
        makefile = self._fetch_file('Makefile')
        if makefile and not commands:
            # Extract common targets
            if 'install:' in makefile or '.PHONY: install' in makefile:
                commands.append({'label': 'Install', 'command': 'make install'})
            if 'run:' in makefile or '.PHONY: run' in makefile:
                commands.append({'label': 'Run', 'command': 'make run'})
            if 'dev:' in makefile or '.PHONY: dev' in makefile:
                commands.append({'label': 'Dev Server', 'command': 'make dev'})

        # Check docker-compose
        docker_compose = self._fetch_file('docker-compose.yml')
        if docker_compose and not commands:
            commands.append({'label': 'Start with Docker', 'command': 'docker-compose up'})

        return commands

    def _discover_features(self, tech_stack: dict) -> list[dict]:
        """
        Discover project features by analyzing directory structure.

        Returns:
            List of feature dictionaries with 'title', 'files', and 'tech' keys
        """
        features = []

        # Check for authentication
        auth_indicators = ['auth', 'authentication', 'login', 'jwt', 'oauth']
        for indicator in auth_indicators:
            try:
                contents = self.repo.get_contents('')
                for item in contents:
                    if indicator in item.name.lower():
                        tech = 'JWT/OAuth' if 'jwt' in item.name.lower() or 'oauth' in item.name.lower() else 'Custom'
                        features.append({'title': 'Authentication', 'files': [item.path], 'tech': tech})
                        break
            except Exception as e:
                logger.warning(f'Failed to detect authentication features: {e}')

        # Check for API
        if 'Django' in tech_stack.get('backend', []):
            features.append({'title': 'REST API', 'files': ['api/'], 'tech': 'Django REST Framework'})
        elif 'Flask' in tech_stack.get('backend', []):
            features.append({'title': 'REST API', 'files': ['api/'], 'tech': 'Flask'})

        return features

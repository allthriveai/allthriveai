from django.core.management.base import BaseCommand

from core.tools.models import Tool


class Command(BaseCommand):
    help = 'Seed common technologies into the Tool model with tool_type=technology'

    def handle(self, *args, **options):
        technologies_data = [
            # Programming Languages
            {
                'name': 'Python',
                'tagline': 'Versatile programming language for everything from scripts to AI',
                'description': (
                    'Python is a high-level, interpreted programming language known for its readability '
                    'and extensive library ecosystem. Popular for web development, '
                    'data science, AI/ML, automation, and more.'
                ),
                'tool_type': 'technology',
                'category': 'language',
                'website_url': 'https://python.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Programming Language', 'Backend', 'Data Science', 'AI', 'Scripting'],
                'key_features': [
                    {'title': 'Readable Syntax', 'description': 'Clean, easy-to-learn syntax'},
                    {'title': 'Extensive Libraries', 'description': 'PyPI has 400,000+ packages'},
                    {'title': 'Cross-Platform', 'description': 'Runs on Windows, macOS, Linux'},
                ],
            },
            {
                'name': 'TypeScript',
                'tagline': 'JavaScript with types for better developer experience',
                'description': (
                    'TypeScript is a strongly typed superset of JavaScript that compiles to plain JavaScript. '
                    'It adds optional static typing and class-based object-oriented programming.'
                ),
                'tool_type': 'technology',
                'category': 'language',
                'website_url': 'https://typescriptlang.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Programming Language', 'Frontend', 'Backend', 'JavaScript', 'Types'],
                'key_features': [
                    {'title': 'Type Safety', 'description': 'Catch errors at compile time'},
                    {'title': 'IDE Support', 'description': 'Excellent autocomplete and refactoring'},
                    {'title': 'JavaScript Compatible', 'description': 'Gradual adoption possible'},
                ],
            },
            {
                'name': 'JavaScript',
                'tagline': 'The language of the web',
                'description': (
                    'JavaScript is a dynamic programming language that runs in browsers and Node.js. '
                    'It powers interactive websites, servers, mobile apps, and more.'
                ),
                'tool_type': 'technology',
                'category': 'language',
                'website_url': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Programming Language', 'Frontend', 'Backend', 'Web'],
                'key_features': [
                    {'title': 'Universal', 'description': 'Runs everywhere - browsers, servers, mobile'},
                    {'title': 'Dynamic', 'description': 'Flexible and expressive'},
                    {'title': 'Ecosystem', 'description': 'Massive npm package ecosystem'},
                ],
            },
            {
                'name': 'Go',
                'tagline': 'Simple, fast, reliable language by Google',
                'description': (
                    'Go (Golang) is a statically typed, compiled language designed at Google. '
                    'Known for simplicity, concurrency support, and fast compilation.'
                ),
                'tool_type': 'technology',
                'category': 'language',
                'website_url': 'https://go.dev',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original-wordmark.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Programming Language', 'Backend', 'Systems', 'Concurrency'],
                'key_features': [
                    {'title': 'Fast Compilation', 'description': 'Compiles in seconds'},
                    {'title': 'Built-in Concurrency', 'description': 'Goroutines and channels'},
                    {'title': 'Simple Syntax', 'description': 'Easy to read and maintain'},
                ],
            },
            {
                'name': 'Rust',
                'tagline': 'Memory-safe systems programming language',
                'description': (
                    'Rust is a systems programming language focused on safety, speed, and concurrency. '
                    'It prevents memory errors without garbage collection.'
                ),
                'tool_type': 'technology',
                'category': 'language',
                'website_url': 'https://rust-lang.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Programming Language', 'Systems', 'Performance', 'Safety'],
                'key_features': [
                    {'title': 'Memory Safety', 'description': 'No null or dangling pointers'},
                    {'title': 'Zero-Cost Abstractions', 'description': 'High-level without overhead'},
                    {'title': 'Fearless Concurrency', 'description': 'Safe parallel programming'},
                ],
            },
            # Frameworks - Frontend
            {
                'name': 'React',
                'tagline': 'Component-based UI library by Meta',
                'description': (
                    'React is a JavaScript library for building user interfaces. '
                    'It uses a component-based architecture and virtual DOM for efficient updates.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://react.dev',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Frontend', 'UI', 'JavaScript', 'Components'],
                'key_features': [
                    {'title': 'Component-Based', 'description': 'Reusable UI building blocks'},
                    {'title': 'Virtual DOM', 'description': 'Efficient DOM updates'},
                    {'title': 'Large Ecosystem', 'description': 'Rich tooling and libraries'},
                ],
            },
            {
                'name': 'Vue.js',
                'tagline': 'Progressive JavaScript framework',
                'description': (
                    'Vue.js is a progressive framework for building user interfaces. '
                    'It features an incrementally adoptable architecture.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://vuejs.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Frontend', 'UI', 'JavaScript', 'Progressive'],
                'key_features': [
                    {'title': 'Approachable', 'description': 'Easy to learn and integrate'},
                    {'title': 'Versatile', 'description': 'Scales from library to framework'},
                    {'title': 'Performant', 'description': 'Optimized reactivity system'},
                ],
            },
            {
                'name': 'Next.js',
                'tagline': 'React framework for production',
                'description': (
                    'Next.js is a React framework that enables server-side rendering, '
                    'static site generation, and API routes out of the box.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://nextjs.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Frontend', 'React', 'SSR', 'Full Stack'],
                'key_features': [
                    {'title': 'Hybrid Rendering', 'description': 'SSR, SSG, and ISR support'},
                    {'title': 'File-Based Routing', 'description': 'Intuitive page structure'},
                    {'title': 'API Routes', 'description': 'Backend endpoints built-in'},
                ],
            },
            {
                'name': 'Tailwind CSS',
                'tagline': 'Utility-first CSS framework',
                'description': (
                    'Tailwind CSS is a utility-first CSS framework for rapidly building custom designs. '
                    'It provides low-level utility classes instead of opinionated components.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://tailwindcss.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['CSS', 'Styling', 'Frontend', 'Utility-First'],
                'key_features': [
                    {'title': 'Utility Classes', 'description': 'Style without leaving HTML'},
                    {'title': 'Customizable', 'description': 'Fully configurable design system'},
                    {'title': 'Production Optimized', 'description': 'Purges unused CSS'},
                ],
            },
            # Frameworks - Backend
            {
                'name': 'Django',
                'tagline': 'High-level Python web framework',
                'description': (
                    'Django is a high-level Python web framework that encourages rapid development '
                    'and clean, pragmatic design. Includes ORM, admin, auth, and more.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://djangoproject.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/django/django-plain.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Backend', 'Python', 'Web Framework', 'Full Stack'],
                'key_features': [
                    {'title': 'Batteries Included', 'description': 'ORM, auth, admin, forms'},
                    {'title': 'Security', 'description': 'Built-in protection against common attacks'},
                    {'title': 'Scalable', 'description': 'Powers sites like Instagram'},
                ],
            },
            {
                'name': 'FastAPI',
                'tagline': 'Modern, fast Python web framework',
                'description': (
                    'FastAPI is a modern, fast (high-performance) web framework for building APIs '
                    'with Python based on standard Python type hints.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://fastapi.tiangolo.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Backend', 'Python', 'API', 'Async'],
                'key_features': [
                    {'title': 'Fast', 'description': 'Very high performance, on par with NodeJS and Go'},
                    {'title': 'Type Hints', 'description': 'Automatic validation and documentation'},
                    {'title': 'Async Support', 'description': 'Native async/await support'},
                ],
            },
            {
                'name': 'Node.js',
                'tagline': 'JavaScript runtime built on V8',
                'description': (
                    "Node.js is a JavaScript runtime built on Chrome's V8 engine. "
                    'It enables server-side JavaScript and powers many web applications.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://nodejs.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Backend', 'JavaScript', 'Runtime', 'Server'],
                'key_features': [
                    {'title': 'Event-Driven', 'description': 'Non-blocking I/O model'},
                    {'title': 'npm Ecosystem', 'description': 'Largest package registry'},
                    {'title': 'Full Stack JS', 'description': 'Same language frontend and backend'},
                ],
            },
            {
                'name': 'Express.js',
                'tagline': 'Minimal Node.js web framework',
                'description': (
                    'Express is a minimal and flexible Node.js web application framework '
                    'that provides a robust set of features for web and mobile applications.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://expressjs.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Backend', 'Node.js', 'API', 'Web Framework'],
                'key_features': [
                    {'title': 'Minimal', 'description': 'Unopinionated and flexible'},
                    {'title': 'Middleware', 'description': 'Powerful middleware architecture'},
                    {'title': 'Battle-Tested', 'description': 'Most popular Node framework'},
                ],
            },
            # Databases
            {
                'name': 'PostgreSQL',
                'tagline': 'Advanced open-source relational database',
                'description': (
                    'PostgreSQL is a powerful, open source object-relational database system '
                    'with over 35 years of active development.'
                ),
                'tool_type': 'technology',
                'category': 'database',
                'website_url': 'https://postgresql.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Database', 'SQL', 'Relational', 'ACID'],
                'key_features': [
                    {'title': 'ACID Compliant', 'description': 'Reliable transactions'},
                    {'title': 'Extensible', 'description': 'Custom types, functions, extensions'},
                    {'title': 'JSON Support', 'description': 'First-class JSON/JSONB'},
                ],
            },
            {
                'name': 'MongoDB',
                'tagline': 'Document-oriented NoSQL database',
                'description': (
                    'MongoDB is a document database designed for ease of development and scaling. '
                    'It stores data in flexible, JSON-like documents.'
                ),
                'tool_type': 'technology',
                'category': 'database',
                'website_url': 'https://mongodb.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['Database', 'NoSQL', 'Document', 'Flexible'],
                'key_features': [
                    {'title': 'Flexible Schema', 'description': 'No rigid structure required'},
                    {'title': 'Horizontal Scaling', 'description': 'Built-in sharding'},
                    {'title': 'Rich Queries', 'description': 'Powerful query language'},
                ],
            },
            {
                'name': 'Redis',
                'tagline': 'In-memory data store and cache',
                'description': (
                    'Redis is an open source, in-memory data structure store used as a database, '
                    'cache, message broker, and streaming engine.'
                ),
                'tool_type': 'technology',
                'category': 'database',
                'website_url': 'https://redis.io',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Database', 'Cache', 'In-Memory', 'Key-Value'],
                'key_features': [
                    {'title': 'In-Memory', 'description': 'Sub-millisecond latency'},
                    {'title': 'Data Structures', 'description': 'Strings, lists, sets, hashes'},
                    {'title': 'Pub/Sub', 'description': 'Built-in messaging'},
                ],
            },
            {
                'name': 'MySQL',
                'tagline': 'Popular open-source relational database',
                'description': (
                    "MySQL is the world's most popular open source relational database. "
                    'Known for reliability, ease of use, and widespread support.'
                ),
                'tool_type': 'technology',
                'category': 'database',
                'website_url': 'https://mysql.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mysql/mysql-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Database', 'SQL', 'Relational', 'Popular'],
                'key_features': [
                    {'title': 'Widely Supported', 'description': 'Extensive tooling and hosting'},
                    {'title': 'Reliable', 'description': 'Proven in production'},
                    {'title': 'Easy Setup', 'description': 'Simple to install and configure'},
                ],
            },
            # Infrastructure & DevOps
            {
                'name': 'Docker',
                'tagline': 'Container platform for app deployment',
                'description': (
                    'Docker is a platform for developing, shipping, and running applications in containers. '
                    'Containers package code and dependencies together.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://docker.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['DevOps', 'Containers', 'Deployment', 'Infrastructure'],
                'key_features': [
                    {'title': 'Containerization', 'description': 'Consistent environments'},
                    {'title': 'Isolation', 'description': 'Apps run independently'},
                    {'title': 'Docker Hub', 'description': 'Public image registry'},
                ],
            },
            {
                'name': 'Kubernetes',
                'tagline': 'Container orchestration platform',
                'description': (
                    'Kubernetes (K8s) is an open-source system for automating deployment, scaling, '
                    'and management of containerized applications.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://kubernetes.io',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['DevOps', 'Orchestration', 'Containers', 'Scaling'],
                'key_features': [
                    {'title': 'Auto-Scaling', 'description': 'Scale based on demand'},
                    {'title': 'Self-Healing', 'description': 'Restarts failed containers'},
                    {'title': 'Service Discovery', 'description': 'Built-in DNS and load balancing'},
                ],
            },
            {
                'name': 'GitHub Actions',
                'tagline': 'CI/CD automation in GitHub',
                'description': (
                    'GitHub Actions automates workflows directly in your repository. '
                    'Build, test, and deploy code right from GitHub.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://github.com/features/actions',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['CI/CD', 'DevOps', 'Automation', 'GitHub'],
                'key_features': [
                    {'title': 'Integrated', 'description': 'Built into GitHub'},
                    {'title': 'Matrix Builds', 'description': 'Test across multiple environments'},
                    {'title': 'Marketplace', 'description': 'Thousands of pre-built actions'},
                ],
            },
            {
                'name': 'Terraform',
                'tagline': 'Infrastructure as Code tool',
                'description': (
                    'Terraform is an infrastructure as code tool that lets you define '
                    'both cloud and on-prem resources in human-readable configuration files.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://terraform.io',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['IaC', 'DevOps', 'Cloud', 'Automation'],
                'key_features': [
                    {'title': 'Multi-Cloud', 'description': 'Works with AWS, GCP, Azure, etc.'},
                    {'title': 'Declarative', 'description': 'Define desired end state'},
                    {'title': 'State Management', 'description': 'Tracks infrastructure changes'},
                ],
            },
            # Cloud Platforms
            {
                'name': 'AWS',
                'tagline': 'Amazon Web Services cloud platform',
                'description': (
                    "AWS (Amazon Web Services) is the world's most comprehensive and broadly adopted "
                    'cloud platform, offering over 200 services.'
                ),
                'tool_type': 'technology',
                'category': 'cloud',
                'website_url': 'https://aws.amazon.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
                'pricing_model': 'pay_per_use',
                'has_free_tier': True,
                'tags': ['Cloud', 'Infrastructure', 'Services', 'Enterprise'],
                'key_features': [
                    {'title': 'Comprehensive', 'description': '200+ cloud services'},
                    {'title': 'Global', 'description': 'Regions worldwide'},
                    {'title': 'Scalable', 'description': 'From startups to enterprises'},
                ],
            },
            {
                'name': 'Google Cloud',
                'tagline': 'Google Cloud Platform services',
                'description': (
                    'Google Cloud Platform (GCP) offers cloud computing services '
                    'running on the same infrastructure Google uses internally.'
                ),
                'tool_type': 'technology',
                'category': 'cloud',
                'website_url': 'https://cloud.google.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/googlecloud/googlecloud-original.svg',
                'pricing_model': 'pay_per_use',
                'has_free_tier': True,
                'tags': ['Cloud', 'Infrastructure', 'Big Data', 'AI/ML'],
                'key_features': [
                    {'title': 'Data Analytics', 'description': 'BigQuery, Dataflow, etc.'},
                    {'title': 'AI/ML', 'description': 'Vertex AI, TensorFlow integration'},
                    {'title': 'Kubernetes Origin', 'description': 'Best GKE experience'},
                ],
            },
            {
                'name': 'Vercel',
                'tagline': 'Frontend deployment platform',
                'description': (
                    'Vercel is a platform for frontend developers, providing the speed and reliability '
                    'innovators need to create at the moment of inspiration.'
                ),
                'tool_type': 'technology',
                'category': 'cloud',
                'website_url': 'https://vercel.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vercel/vercel-original.svg',
                'pricing_model': 'freemium',
                'has_free_tier': True,
                'tags': ['Cloud', 'Hosting', 'Frontend', 'Edge'],
                'key_features': [
                    {'title': 'Edge Network', 'description': 'Global CDN deployment'},
                    {'title': 'Preview Deploys', 'description': 'URL for every PR'},
                    {'title': 'Next.js Native', 'description': 'First-class Next.js support'},
                ],
            },
            # Testing
            {
                'name': 'Jest',
                'tagline': 'JavaScript testing framework',
                'description': (
                    'Jest is a delightful JavaScript testing framework with a focus on simplicity. '
                    'Works with projects using React, Node, TypeScript, and more.'
                ),
                'tool_type': 'technology',
                'category': 'testing',
                'website_url': 'https://jestjs.io',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Testing', 'JavaScript', 'Unit Tests', 'Coverage'],
                'key_features': [
                    {'title': 'Zero Config', 'description': 'Works out of the box'},
                    {'title': 'Snapshots', 'description': 'Track UI changes'},
                    {'title': 'Parallel Tests', 'description': 'Fast test execution'},
                ],
            },
            {
                'name': 'Pytest',
                'tagline': 'Python testing framework',
                'description': (
                    'pytest is a mature full-featured Python testing tool that helps you write '
                    'better programs with simple, scalable tests.'
                ),
                'tool_type': 'technology',
                'category': 'testing',
                'website_url': 'https://pytest.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytest/pytest-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Testing', 'Python', 'Unit Tests', 'Fixtures'],
                'key_features': [
                    {'title': 'Simple Syntax', 'description': 'No boilerplate needed'},
                    {'title': 'Fixtures', 'description': 'Powerful test setup'},
                    {'title': 'Plugins', 'description': 'Rich ecosystem of plugins'},
                ],
            },
            {
                'name': 'Playwright',
                'tagline': 'End-to-end testing for modern web apps',
                'description': (
                    'Playwright enables reliable end-to-end testing for modern web apps. '
                    'Cross-browser testing with Chromium, Firefox, and WebKit.'
                ),
                'tool_type': 'technology',
                'category': 'testing',
                'website_url': 'https://playwright.dev',
                'logo_url': 'https://playwright.dev/img/playwright-logo.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Testing', 'E2E', 'Browser', 'Automation'],
                'key_features': [
                    {'title': 'Cross-Browser', 'description': 'Chrome, Firefox, Safari'},
                    {'title': 'Auto-Wait', 'description': 'Smart waits for elements'},
                    {'title': 'Tracing', 'description': 'Debug with full trace'},
                ],
            },
            # Additional popular technologies
            {
                'name': 'Git',
                'tagline': 'Distributed version control system',
                'description': (
                    'Git is a free and open source distributed version control system '
                    'designed to handle everything from small to very large projects.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://git-scm.com',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Version Control', 'DevOps', 'Collaboration'],
                'key_features': [
                    {'title': 'Distributed', 'description': 'Full repo on every machine'},
                    {'title': 'Branching', 'description': 'Lightweight branch operations'},
                    {'title': 'Speed', 'description': 'Local operations are fast'},
                ],
            },
            {
                'name': 'GraphQL',
                'tagline': 'Query language for APIs',
                'description': (
                    'GraphQL is a query language for APIs and a runtime for fulfilling those queries. '
                    'Provides a complete description of data in your API.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://graphql.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['API', 'Query Language', 'Backend', 'Frontend'],
                'key_features': [
                    {'title': 'Ask For What You Need', 'description': 'No over-fetching'},
                    {'title': 'Single Endpoint', 'description': 'One request, multiple resources'},
                    {'title': 'Type System', 'description': 'Self-documenting API'},
                ],
            },
            {
                'name': 'Nginx',
                'tagline': 'Web server and reverse proxy',
                'description': (
                    'NGINX is a web server that can also be used as a reverse proxy, '
                    'load balancer, mail proxy and HTTP cache.'
                ),
                'tool_type': 'technology',
                'category': 'infrastructure',
                'website_url': 'https://nginx.org',
                'logo_url': 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nginx/nginx-original.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Web Server', 'Reverse Proxy', 'Load Balancing'],
                'key_features': [
                    {'title': 'High Performance', 'description': 'Handles many connections'},
                    {'title': 'Reverse Proxy', 'description': 'Route traffic to backends'},
                    {'title': 'Load Balancing', 'description': 'Distribute requests'},
                ],
            },
            {
                'name': 'Vite',
                'tagline': 'Next generation frontend tooling',
                'description': (
                    'Vite is a build tool that aims to provide a faster and leaner development '
                    'experience for modern web projects.'
                ),
                'tool_type': 'technology',
                'category': 'framework',
                'website_url': 'https://vitejs.dev',
                'logo_url': 'https://vitejs.dev/logo.svg',
                'pricing_model': 'open_source',
                'has_free_tier': True,
                'tags': ['Build Tool', 'Frontend', 'Development', 'Fast'],
                'key_features': [
                    {'title': 'Instant Server Start', 'description': 'No bundling in dev'},
                    {'title': 'Lightning HMR', 'description': 'Fast hot module replacement'},
                    {'title': 'Optimized Build', 'description': 'Rollup-powered production builds'},
                ],
            },
        ]

        created_count = 0
        updated_count = 0

        for data in technologies_data:
            tool, created = Tool.objects.get_or_create(
                name=data['name'],
                defaults={
                    'tagline': data['tagline'],
                    'description': data['description'],
                    'tool_type': data['tool_type'],
                    'category': data['category'],
                    'website_url': data['website_url'],
                    'logo_url': data.get('logo_url', ''),
                    'pricing_model': data['pricing_model'],
                    'has_free_tier': data['has_free_tier'],
                    'tags': data['tags'],
                    'key_features': data.get('key_features', []),
                    'is_active': True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'✓ Created technology: {tool.name}'))
            else:
                # Update fields but preserve tool_type if already set
                tool.tagline = data['tagline']
                tool.description = data['description']
                if tool.tool_type == 'ai_tool':  # Only update if it was default
                    tool.tool_type = data['tool_type']
                tool.category = data['category']
                tool.website_url = data['website_url']
                tool.logo_url = data.get('logo_url', '')
                tool.pricing_model = data['pricing_model']
                tool.has_free_tier = data['has_free_tier']
                tool.tags = data['tags']
                tool.key_features = data.get('key_features', [])
                tool.save()
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'↻ Updated technology: {tool.name}'))

        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Technologies seeded! Created: {created_count}, Updated: {updated_count}')
        )

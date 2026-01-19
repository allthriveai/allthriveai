---
description: Set up this project with vibe-and-thrive best practices and guardrails for agentic coding.
---

# Vibe & Thrive Setup

Set up this project with best practices and guardrails for agentic coding.

## First, ask the user

"How would you like to get started?

1. **Quick Setup** - I know what I'm doing, just configure my project
2. **Feature Tour** - Show me what vibe-and-thrive can do first
3. **New to Claude Code** - Teach me the basics"

## Path 1: Quick Setup

Detect project type and install everything:

### 1. Install Claude Code slash commands
```bash
mkdir -p .claude/commands
```
Copy all .md files from the vibe-and-thrive .claude/commands/ directory to the project's .claude/commands/

### 2. Set up pre-commit hooks
Create `.pre-commit-config.yaml` if it doesn't exist:
```yaml
repos:
  - repo: https://github.com/allthriveai/vibe-and-thrive
    rev: v1.0.0
    hooks:
      - id: check-secrets
      - id: check-hardcoded-urls
      - id: vibe-check-quality
```

Then run `pre-commit install` if pre-commit is available.

### 3. Initialize Ralph
Run `ralph init` or create the .ralph directory structure manually.

### 4. Configure MCP (optional)
Add Chrome DevTools MCP to ~/.claude.json if not already configured.

### 5. Show completion message
List what was installed and suggest next commands:
- `ralph prd "idea"` - Start autonomous development
- `/help` - See available slash commands
- `vibe-check .` - Scan code for issues

## Path 2: Feature Tour

Explain each feature with examples before installing:

### vibe-check
"vibe-check scans your code for common AI-generated issues like hardcoded URLs, overly complex functions, and missing error handling."

Show example output.

### Pre-commit hooks
"Pre-commit hooks automatically block bad commits - secrets, hardcoded URLs, quality issues."

Show example of blocked commit.

### Ralph
"Ralph is an autonomous development loop. You describe a feature, it asks clarifying questions, generates user stories, and codes until all tests pass."

Show example workflow.

### Slash commands
"11 pre-built prompts for common tasks: /prd, /review, /refactor, /tdd-feature, /e2e-scaffold, etc."

List them all.

After the tour, ask if they want to install. If yes, run Quick Setup.

## Path 3: New to Claude Code Tutorial

Teach the basics interactively:

### Lesson 1: What is Claude Code?
Explain it's Anthropic's CLI for Claude - reads codebase, writes code, runs commands, uses tools.

### Lesson 2: Slash commands
Explain built-in (/help, /clear, /compact) and custom commands from .claude/commands/

### Lesson 3: MCP Servers
Explain Model Context Protocol - lets Claude use external tools like Chrome DevTools.

### Lesson 4: How vibe-and-thrive enhances Claude Code
Explain the integration: skills, hooks, Ralph, quality checks.

After tutorial, run Quick Setup.

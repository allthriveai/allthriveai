# Legacy & Deprecated Code Review

**Date**: 2025-12-20

## Deprecated Items (Active Deprecation Notices)

| Location | What | Status |
|----------|------|--------|
| `services/agents/discovery/prompts.py:4` | Discovery agent routing | Deprecated - use Ember agent |
| `services/agents/orchestration/prompts.py:4` | Orchestration agent routing | Deprecated - use Ember agent |
| `services/agents/learning/components/learner_context.py` | `LearnerContextService` | Use `MemberContextService` |
| `services/agents/auth/validators.py` | `validate_email`, `validate_name`, etc. | Use `ValidationService` |
| `services/agents/project/tools.py:2521` | `import_video_project` | Use `create_media_project` |
| `core/management/commands/seed_companies.py` | `seed_companies` command | Merged into `seed_tools` |
| `core/projects/models.py:240` | `difficulty` CharField | Use `difficulty_taxonomy` |
| `core/quizzes/models.py:19-37` | `difficulty`, `topic` fields | Use taxonomy fields |
| `core/learning_paths/models.py:66,371,919` | Various `topic` fields | Use `topic_taxonomy` |

## Legacy Items (Backwards Compatibility)

| Location | What | Purpose |
|----------|------|---------|
| `frontend/src/routes/index.tsx:265-522` | `/battles/`, `/play/prompt-battle` routes | Redirect to new routes |
| `services/weaviate/embeddings.py:476` | Block-based content | templateVersion 1 support |
| `frontend/src/lib/generators/github-layout-generator.ts:74` | `LegacyBlock` interface | Old project format |
| `frontend/src/utils/categoryColors.ts:9` | Legacy colors | Color mapping compatibility |
| `core/avatars/models.py:24` | `'legacy'` creation mode | Pre-existing avatars |
| `frontend/src/hooks/useEmberOnboarding.ts:13` | Legacy onboarding IDs | Backwards compatibility |

## NPM Legacy (Not Code Debt)

- `--legacy-peer-deps` in CI/docker - Required for npm compatibility, not code debt

## Notes

The deprecated agent files (`discovery/prompts.py`, `orchestration/prompts.py`) are the most notable - all chat routing now goes through the unified Ember agent as of 2025-12-19.

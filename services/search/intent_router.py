"""
Intent detection for routing search queries to appropriate content types.

Detects user intent from natural language queries to determine
which content types to search (project, quiz, tool, micro_lesson).
"""

import re
from dataclasses import dataclass
from typing import Literal

ContentType = Literal['project', 'quiz', 'tool', 'micro_lesson']

# Keywords that indicate specific content type intent
INTENT_KEYWORDS: dict[ContentType, list[str]] = {
    'quiz': [
        'quiz',
        'quizzes',
        'test',
        'tests',
        'challenge',
        'challenges',
        'assessment',
        'assessments',
        'exam',
        'question',
        'questions',
    ],
    'tool': [
        'tool',
        'tools',
        'app',
        'apps',
        'application',
        'applications',
        'software',
        'platform',
        'platforms',
        'service',
        'services',
        'product',
        'products',
    ],
    'micro_lesson': [
        'lesson',
        'lessons',
        'learn',
        'learning',
        'teach',
        'teaching',
        'explain',
        'explanation',
        'tutorial',
        'tutorials',
        'guide',
        'guides',
        'concept',
        'concepts',
        'introduction',
        'intro',
    ],
    'project': [
        'project',
        'projects',
        'example',
        'examples',
        'demo',
        'demos',
        'showcase',
        'showcases',
        'case study',
        'case studies',
        'implementation',
        'implementations',
        'build',
        'building',
        'code',
        'coding',
        'repository',
        'repo',
    ],
}

# Patterns that modify intent
INTENT_MODIFIERS = {
    'how_to': r'\bhow\s+(?:to|do|can|should)\b',
    'what_is': r'\bwhat\s+(?:is|are)\b',
    'find': r'\b(?:find|search|look|show|give|recommend|suggest)\b',
    'compare': r'\b(?:compare|vs|versus|difference|between)\b',
}


@dataclass
class IntentResult:
    """Result of intent detection."""

    primary_intent: str  # 'search', 'learn', 'practice', 'compare', 'discover'
    content_types: list[ContentType]
    confidence: float
    extracted_topic: str | None = None


class IntentRouter:
    """
    Detect user intent to route queries to appropriate content types.

    Examples:
        - "quiz about RAG" → content_types=['quiz']
        - "tools for image generation" → content_types=['tool']
        - "learn about agents" → content_types=['project', 'quiz', 'micro_lesson']
        - "show me projects using LangChain" → content_types=['project']
    """

    @classmethod
    def detect_intent(cls, query: str) -> tuple[str, list[ContentType]]:
        """
        Detect user intent from query.

        Args:
            query: Natural language search query

        Returns:
            Tuple of (intent_type, list of content types to search)
        """
        result = cls.analyze_query(query)
        return result.primary_intent, result.content_types

    @classmethod
    def analyze_query(cls, query: str) -> IntentResult:
        """
        Full intent analysis with confidence and topic extraction.

        Args:
            query: Natural language search query

        Returns:
            IntentResult with detected intent and metadata
        """
        query_lower = query.lower().strip()
        detected_types: list[ContentType] = []
        keyword_matches: dict[ContentType, int] = {}

        # Count keyword matches for each content type
        for content_type, keywords in INTENT_KEYWORDS.items():
            matches = 0
            for keyword in keywords:
                # Use word boundary matching
                pattern = rf'\b{re.escape(keyword)}\b'
                if re.search(pattern, query_lower):
                    matches += 1
            if matches > 0:
                keyword_matches[content_type] = matches

        # Determine primary intent based on modifiers
        primary_intent = 'discover'
        for modifier, pattern in INTENT_MODIFIERS.items():
            if re.search(pattern, query_lower):
                if modifier == 'how_to':
                    primary_intent = 'learn'
                elif modifier == 'what_is':
                    primary_intent = 'learn'
                elif modifier == 'find':
                    primary_intent = 'search'
                elif modifier == 'compare':
                    primary_intent = 'compare'
                break

        # If specific content types detected, use those
        if keyword_matches:
            # Sort by match count, highest first
            sorted_types = sorted(keyword_matches.items(), key=lambda x: x[1], reverse=True)
            detected_types = [t for t, _ in sorted_types]

            # If high confidence in one type, just return that
            if sorted_types[0][1] >= 2:
                detected_types = [sorted_types[0][0]]

        # Default content types based on intent if none detected
        if not detected_types:
            if primary_intent == 'learn':
                detected_types = ['micro_lesson', 'project', 'quiz']
            elif primary_intent == 'compare':
                detected_types = ['tool']
            elif primary_intent == 'practice':
                detected_types = ['quiz', 'project']
            else:
                # Default: search all types
                detected_types = ['project', 'quiz', 'tool', 'micro_lesson']

        # Extract topic by removing intent keywords
        topic = cls._extract_topic(query_lower, detected_types)

        # Calculate confidence
        confidence = cls._calculate_confidence(query_lower, keyword_matches)

        return IntentResult(
            primary_intent=primary_intent,
            content_types=detected_types,
            confidence=confidence,
            extracted_topic=topic,
        )

    @classmethod
    def _extract_topic(cls, query: str, detected_types: list[ContentType]) -> str | None:
        """Extract the core topic from query by removing intent keywords."""
        topic = query

        # Remove intent keywords
        for content_type in detected_types:
            for keyword in INTENT_KEYWORDS.get(content_type, []):
                topic = re.sub(rf'\b{re.escape(keyword)}s?\b', '', topic)

        # Remove common filler words
        fillers = [
            'about',
            'for',
            'on',
            'with',
            'using',
            'to',
            'the',
            'a',
            'an',
            'me',
            'show',
            'find',
            'give',
            'some',
            'any',
            'that',
            'which',
        ]
        for filler in fillers:
            topic = re.sub(rf'\b{filler}\b', '', topic)

        # Clean up whitespace
        topic = ' '.join(topic.split()).strip()

        return topic if topic else None

    @classmethod
    def _calculate_confidence(
        cls,
        query: str,
        keyword_matches: dict[ContentType, int],
    ) -> float:
        """Calculate confidence score for intent detection."""
        if not keyword_matches:
            return 0.5  # Default confidence when no keywords matched

        max_matches = max(keyword_matches.values())

        # Higher confidence if:
        # - More keyword matches
        # - Single dominant content type
        base_confidence = min(0.5 + (max_matches * 0.15), 0.95)

        # Penalty for ambiguity (multiple types with similar matches)
        if len(keyword_matches) > 1:
            match_values = list(keyword_matches.values())
            if max(match_values) - min(match_values) <= 1:
                base_confidence *= 0.85  # Ambiguous

        return round(base_confidence, 2)

    @classmethod
    def get_collection_names(cls, content_types: list[ContentType]) -> list[str]:
        """
        Map content types to Weaviate collection names.

        Args:
            content_types: List of content types

        Returns:
            List of Weaviate collection names
        """
        from services.weaviate.schema import WeaviateSchema

        mapping = {
            'project': WeaviateSchema.PROJECT_COLLECTION,
            'quiz': WeaviateSchema.QUIZ_COLLECTION,
            'tool': WeaviateSchema.TOOL_COLLECTION,
            'micro_lesson': WeaviateSchema.MICRO_LESSON_COLLECTION,
        }

        return [mapping[ct] for ct in content_types if ct in mapping]

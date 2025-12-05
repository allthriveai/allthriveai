"""
Hallucination Detection and Confidence Scoring System

Tracks LLM outputs to detect and prevent hallucinations across the platform.
"""

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from django.core.cache import cache

from core.logging_utils import StructuredLogger

logger = logging.getLogger(__name__)


class HallucinationType(str, Enum):
    """Types of hallucinations we can detect."""

    FACTUAL_ERROR = 'factual_error'  # Contradicts known facts
    FABRICATED_DATA = 'fabricated_data'  # Makes up non-existent data
    INCONSISTENT_RESPONSE = 'inconsistent_response'  # Contradicts previous statements
    OVERCONFIDENT = 'overconfident'  # Claims certainty without evidence
    OUT_OF_SCOPE = 'out_of_scope'  # Answers outside system capabilities


class ConfidenceLevel(str, Enum):
    """Confidence levels for LLM responses."""

    HIGH = 'high'  # 90-100% - Verified facts, direct tool outputs
    MEDIUM = 'medium'  # 70-89% - LLM interpretation with validation
    LOW = 'low'  # 50-69% - LLM speculation, unverified
    UNCERTAIN = 'uncertain'  # <50% - High risk of hallucination


@dataclass
class HallucinationReport:
    """Report of a detected or suspected hallucination."""

    type: HallucinationType
    confidence: float  # 0.0-1.0
    message: str
    context: dict[str, Any]
    detected_at: datetime
    flagged_by: str  # 'system' or user ID


@dataclass
class ResponseConfidence:
    """Confidence assessment for an LLM response."""

    level: ConfidenceLevel
    score: float  # 0.0-1.0
    reasoning: str
    warnings: list[str]
    verified_facts: list[str]
    unverified_claims: list[str]


class HallucinationDetector:
    """
    Detects hallucinations in LLM responses.

    Methods:
    1. Fact verification against ground truth (tool outputs, DB)
    2. Consistency checking (compare with chat history)
    3. Confidence scoring (probabilistic detection)
    4. Pattern matching (known hallucination patterns)
    """

    # Patterns that indicate possible hallucinations
    OVERCONFIDENT_PATTERNS = [
        r'definitely',
        r'certainly',
        r'100%',
        r'always',
        r'never',
        r'guaranteed',
        r'without\s+a\s+doubt',
    ]

    # Patterns that indicate fabricated data
    FABRICATED_DATA_PATTERNS = [
        r'I\s+(found|discovered|detected)\s+\d+\s+',  # "I found 347 files"
        r'according\s+to\s+my\s+analysis',
        r'based\s+on\s+my\s+knowledge',
        r'I\s+can\s+see\s+that',  # When no vision capability
    ]

    def __init__(self):
        self.cache = cache

    def analyze_response(
        self,
        response: str,
        tool_outputs: list[dict[str, Any]] = None,
        conversation_history: list[dict[str, Any]] = None,
        ground_truth: dict[str, Any] = None,
    ) -> ResponseConfidence:
        """
        Analyze an LLM response for hallucinations and return confidence score.

        Args:
            response: The LLM's response text
            tool_outputs: Outputs from tools executed (source of truth)
            conversation_history: Previous messages in conversation
            ground_truth: Known facts from database (e.g., actual GitHub metadata)

        Returns:
            ResponseConfidence with score and analysis
        """
        score = 1.0  # Start at 100%
        warnings = []
        verified_facts = []
        unverified_claims = []

        # 1. Check for overconfident language (reduces confidence)
        for pattern in self.OVERCONFIDENT_PATTERNS:
            if re.search(pattern, response, re.IGNORECASE):
                score -= 0.1
                warnings.append(f'Overconfident language detected: {pattern}')

        # 2. Check for fabricated data patterns
        for pattern in self.FABRICATED_DATA_PATTERNS:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                score -= 0.2
                warnings.append(f'Possible fabrication: {match.group()}')

        # 3. Verify against tool outputs (ground truth)
        if tool_outputs:
            verified, unverified = self._verify_against_tools(response, tool_outputs)
            verified_facts.extend(verified)
            unverified_claims.extend(unverified)

            # Penalize if making claims not backed by tools
            if unverified_claims:
                penalty = min(len(unverified_claims) * 0.1, 0.3)
                score -= penalty
                warnings.append(f'{len(unverified_claims)} unverified claims found')

        # 4. Check consistency with conversation history
        if conversation_history:
            inconsistencies = self._check_consistency(response, conversation_history)
            if inconsistencies:
                score -= 0.2
                warnings.append(f'Inconsistent with previous statements: {inconsistencies[0]}')

        # 5. Verify against ground truth database
        if ground_truth:
            contradictions = self._check_ground_truth(response, ground_truth)
            if contradictions:
                score -= 0.3  # Major penalty for contradicting known facts
                warnings.append(f'Contradicts known facts: {contradictions[0]}')

        # Clamp score to 0-1
        score = max(0.0, min(1.0, score))

        # Determine confidence level
        if score >= 0.9:
            level = ConfidenceLevel.HIGH
        elif score >= 0.7:
            level = ConfidenceLevel.MEDIUM
        elif score >= 0.5:
            level = ConfidenceLevel.LOW
        else:
            level = ConfidenceLevel.UNCERTAIN

        # Generate reasoning
        reasoning = self._generate_reasoning(score, verified_facts, unverified_claims, warnings)

        return ResponseConfidence(
            level=level,
            score=score,
            reasoning=reasoning,
            warnings=warnings,
            verified_facts=verified_facts,
            unverified_claims=unverified_claims,
        )

    def _verify_against_tools(self, response: str, tool_outputs: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
        """
        Verify response claims against tool outputs.

        Returns:
            (verified_facts, unverified_claims)
        """
        verified = []
        unverified = []

        # Extract claims from response (simple heuristic)
        # In production, use NLP to extract entities/facts

        for output in tool_outputs:
            if isinstance(output, dict):
                # Check if response mentions tool data
                for key, value in output.items():
                    if isinstance(value, str | int | float):
                        value_str = str(value)
                        if value_str in response:
                            verified.append(f'{key}: {value_str}')

        # Simple check: any numeric claims?
        numbers = re.findall(r'\d+', response)
        for num in numbers:
            # Check if number appears in any tool output
            found = any(num in json.dumps(output) for output in tool_outputs)
            if not found and len(num) > 2:  # Ignore small numbers
                unverified.append(f'Unverified number: {num}')

        return verified, unverified

    def _check_consistency(self, response: str, conversation_history: list[dict[str, Any]]) -> list[str]:
        """
        Check if response contradicts previous statements.

        Returns list of inconsistencies found.
        """
        inconsistencies = []

        # Simple check: look for contradictory statements
        # Example: "Yes" followed by "No", or "is" vs "is not"
        response_lower = response.lower()

        for msg in conversation_history:
            if msg.get('role') == 'assistant':
                prev_content = msg.get('content', '').lower()

                # Check for direct contradictions (simple heuristic)
                if 'yes' in prev_content and 'no' in response_lower:
                    inconsistencies.append("Changed answer from 'yes' to 'no'")
                elif 'cannot' in prev_content and 'can' in response_lower:
                    inconsistencies.append('Changed capability claim')

        return inconsistencies

    def _check_ground_truth(self, response: str, ground_truth: dict[str, Any]) -> list[str]:
        """
        Check if response contradicts known facts from database.

        Returns list of contradictions found.
        """
        contradictions = []

        response_lower = response.lower()

        for key, value in ground_truth.items():
            value_str = str(value).lower()

            # Check if response mentions this field
            if key.lower() in response_lower:
                # Check if value matches
                if value_str not in response_lower:
                    contradictions.append(f'{key} mismatch (expected: {value})')

        return contradictions

    def _generate_reasoning(
        self,
        score: float,
        verified_facts: list[str],
        unverified_claims: list[str],
        warnings: list[str],
    ) -> str:
        """Generate human-readable reasoning for confidence score."""
        if score >= 0.9:
            return f'High confidence - {len(verified_facts)} facts verified against tool outputs'
        elif score >= 0.7:
            return f'Medium confidence - some verified facts but {len(unverified_claims)} unverified claims'
        elif score >= 0.5:
            return f'Low confidence - {len(warnings)} warnings detected, limited verification'
        else:
            return f"Uncertain - {len(warnings)} critical issues: {', '.join(warnings[:2])}"

    def flag_hallucination(
        self,
        response: str,
        hallucination_type: HallucinationType,
        confidence: float,
        context: dict[str, Any],
        flagged_by: str = 'system',
    ) -> HallucinationReport:
        """
        Flag a suspected or confirmed hallucination for review.

        This creates a record that can be used for:
        1. Immediate user warnings
        2. Model fine-tuning
        3. Analytics/reporting
        """
        report = HallucinationReport(
            type=hallucination_type,
            confidence=confidence,
            message=response[:500],  # Truncate for storage
            context=context,
            detected_at=datetime.now(),
            flagged_by=flagged_by,
        )

        # Log for monitoring
        StructuredLogger.log_service_operation(
            service_name='HallucinationDetector',
            operation='flag_hallucination',
            success=True,
            metadata={
                'type': hallucination_type.value,
                'confidence': confidence,
                'flagged_by': flagged_by,
                'context': context,
            },
        )

        # Store in cache for recent tracking (last 1 hour)
        cache_key = f"hallucination:{context.get('session_id', 'unknown')}:{datetime.now().timestamp()}"
        self.cache.set(cache_key, report.__dict__, timeout=3600)

        # TODO: Store in database for long-term analysis
        # HallucinationLog.objects.create(...)

        return report

    def get_recent_hallucinations(self, hours: int = 24) -> list[HallucinationReport]:
        """Get recent hallucination reports for monitoring."""
        # This is a simplified version - in production, query from database
        # For now, return empty list as we don't have DB model yet
        return []


# Singleton instance
hallucination_detector = HallucinationDetector()

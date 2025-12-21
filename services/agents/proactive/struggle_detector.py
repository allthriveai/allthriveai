"""
Real-time Struggle Pattern Detection.

Detects when a user is struggling during a conversation by analyzing:
- Confusion language patterns
- Repeated questions on same topic
- Quick follow-up questions
- Conversation flow patterns

Returns actionable struggle signals for proactive intervention.
"""

import logging
from typing import TypedDict

logger = logging.getLogger(__name__)


class StruggleSignal(TypedDict):
    """A detected struggle signal."""

    confidence: float  # 0.0 - 1.0
    struggle_type: str  # concept_confusion, frustration, stuck_on_topic, rapid_questions
    topic: str | None
    concept: str | None
    signals: list[str]  # List of signals that contributed to detection
    suggested_intervention: str  # simplify_explanation, suggest_prerequisite, offer_example, take_break


class StrugglePatternDetector:
    """
    Real-time detection of user struggle during conversations.

    Analyzes conversation history and current message to detect
    signs of confusion or frustration.
    """

    # Time window for analyzing recent messages (seconds)
    ANALYSIS_WINDOW = 300  # 5 minutes

    # Minimum confidence threshold for intervention
    MIN_CONFIDENCE = 0.5

    # Confusion patterns (same as GapDetector for consistency)
    CONFUSION_PATTERNS = [
        (r"i don'?t understand", 0.8, 'explicit_confusion'),
        (r'can you explain again', 0.7, 'request_repeat'),
        (r'what do you mean', 0.6, 'clarification'),
        (r"i'?m confused", 0.85, 'explicit_confusion'),
        (r'this is confusing', 0.8, 'explicit_confusion'),
        (r"i'?m lost", 0.75, 'explicit_confusion'),
        (r"i don'?t get it", 0.75, 'explicit_confusion'),
        (r'could you simplify', 0.6, 'request_simplify'),
        (r'in simpler terms', 0.6, 'request_simplify'),
        (r'what does .{1,50} mean', 0.5, 'definition_request'),
        (r'i thought .{1,50} was', 0.6, 'misconception'),
        (r'wait,? so', 0.4, 'processing'),
        (r'let me make sure i understand', 0.5, 'verification'),
    ]

    # Frustration patterns (stronger signals)
    FRUSTRATION_PATTERNS = [
        (r"this (is|isn'?t) working", 0.7, 'frustration'),
        (r"why (won'?t|doesn'?t)", 0.6, 'frustration'),
        (r'i give up', 0.9, 'frustration'),
        (r'this is (too hard|impossible)', 0.8, 'frustration'),
        (r"i can'?t (figure|do|get) this", 0.7, 'frustration'),
        (r'nothing (is working|works)', 0.7, 'frustration'),
        (r'ugh|argh', 0.5, 'frustration'),
    ]

    def __init__(self):
        import re

        # Compile patterns for efficiency
        self._confusion_compiled = [(re.compile(p, re.IGNORECASE), c, t) for p, c, t in self.CONFUSION_PATTERNS]
        self._frustration_compiled = [(re.compile(p, re.IGNORECASE), c, t) for p, c, t in self.FRUSTRATION_PATTERNS]

    def detect_current_struggle(
        self,
        user_id: int,
        messages: list[dict],
        member_context: dict | None = None,
    ) -> StruggleSignal | None:
        """
        Detect if user is currently struggling in the conversation.

        Args:
            user_id: User ID
            messages: Recent messages in format [{'role': 'user'|'assistant', 'content': str}]
            member_context: Optional MemberContext for additional signals

        Returns:
            StruggleSignal if struggle detected with confidence >= MIN_CONFIDENCE, else None
        """
        if not messages:
            return None

        signals: list[str] = []
        confidence_scores: list[float] = []

        # Get user messages only (last 10)
        user_messages = [m for m in messages if m.get('role') == 'user'][-10:]
        if not user_messages:
            return None

        # Current message is most important
        current_message = user_messages[-1].get('content', '') if user_messages else ''
        current_lower = current_message.lower().strip()

        # 1. Check for confusion patterns in current message
        confusion_result = self._analyze_confusion(current_lower)
        if confusion_result:
            signals.extend(confusion_result['signals'])
            confidence_scores.append(confusion_result['confidence'] * 1.2)  # Weight current message higher

        # 2. Check for frustration patterns
        frustration_result = self._analyze_frustration(current_lower)
        if frustration_result:
            signals.extend(frustration_result['signals'])
            confidence_scores.append(frustration_result['confidence'] * 1.3)  # Frustration is serious

        # 3. Check for repeated confusion in recent messages
        recent_confusion = self._check_repeated_confusion(user_messages)
        if recent_confusion:
            signals.append('repeated_confusion')
            confidence_scores.append(0.7)

        # 4. Check for rapid-fire questions (many questions in short window)
        if len(user_messages) >= 3:
            question_rate = self._calculate_question_rate(user_messages[-5:])
            if question_rate > 0.6:  # More than 60% are questions
                signals.append('rapid_questions')
                confidence_scores.append(0.5)

        # 5. Check for topic repetition (asking about same thing multiple ways)
        topic_repetition = self._check_topic_repetition(user_messages[-5:])
        if topic_repetition:
            signals.append('stuck_on_topic')
            confidence_scores.append(0.6)

        # 6. Factor in knowledge gaps if available
        if member_context:
            detected_gaps = member_context.get('detected_gaps', [])
            if detected_gaps:
                # If they have known gaps and are showing confusion, boost confidence
                high_confidence_gaps = [g for g in detected_gaps if g.get('confidence', 0) > 0.6]
                if high_confidence_gaps and signals:
                    signals.append('has_knowledge_gaps')
                    confidence_scores.append(0.4)

        if not confidence_scores:
            return None

        # Calculate final confidence (weighted average with max boost)
        avg_confidence = sum(confidence_scores) / len(confidence_scores)
        # Boost for multiple signals
        signal_boost = min(0.2, (len(signals) - 1) * 0.05)
        final_confidence = min(0.95, avg_confidence + signal_boost)

        if final_confidence < self.MIN_CONFIDENCE:
            return None

        # Determine struggle type and intervention
        struggle_type, intervention = self._determine_struggle_type(signals)

        # Extract topic if possible
        topic = self._extract_topic(current_message, member_context)

        return {
            'confidence': round(final_confidence, 2),
            'struggle_type': struggle_type,
            'topic': topic,
            'concept': None,  # Could extract from message if needed
            'signals': signals,
            'suggested_intervention': intervention,
        }

    async def detect_current_struggle_async(
        self,
        user_id: int,
        messages: list[dict],
        member_context: dict | None = None,
    ) -> StruggleSignal | None:
        """Async version of detect_current_struggle."""
        from asgiref.sync import sync_to_async

        return await sync_to_async(self.detect_current_struggle)(user_id, messages, member_context)

    def _analyze_confusion(self, text: str) -> dict | None:
        """Analyze text for confusion patterns."""
        matched: list[tuple[str, float]] = []

        for pattern, confidence, _ in self._confusion_compiled:
            if pattern.search(text):
                matched.append((pattern.pattern, confidence))

        if not matched:
            return None

        avg_confidence = sum(c for _, c in matched) / len(matched)
        return {
            'confidence': avg_confidence,
            'signals': [f'confusion:{p[:30]}' for p, _ in matched],
        }

    def _analyze_frustration(self, text: str) -> dict | None:
        """Analyze text for frustration patterns."""
        matched: list[tuple[str, float]] = []

        for pattern, confidence, _ in self._frustration_compiled:
            if pattern.search(text):
                matched.append((pattern.pattern, confidence))

        if not matched:
            return None

        avg_confidence = sum(c for _, c in matched) / len(matched)
        return {
            'confidence': avg_confidence,
            'signals': ['frustration'],
        }

    def _check_repeated_confusion(self, messages: list[dict]) -> bool:
        """Check if there's repeated confusion in recent messages."""
        if len(messages) < 2:
            return False

        confusion_count = 0
        for msg in messages[-5:]:
            content = msg.get('content', '').lower()
            for pattern, _, _ in self._confusion_compiled:
                if pattern.search(content):
                    confusion_count += 1
                    break

        return confusion_count >= 2

    def _calculate_question_rate(self, messages: list[dict]) -> float:
        """Calculate what percentage of messages are questions."""
        if not messages:
            return 0.0

        question_count = 0
        for msg in messages:
            content = msg.get('content', '').strip()
            # Simple heuristic: ends with ? or starts with question words
            if content.endswith('?') or any(
                content.lower().startswith(w) for w in ['what', 'how', 'why', 'when', 'where', 'can', 'could', 'is']
            ):
                question_count += 1

        return question_count / len(messages)

    def _check_topic_repetition(self, messages: list[dict]) -> bool:
        """Check if user is asking about the same topic repeatedly."""
        if len(messages) < 2:
            return False

        # Simple heuristic: check for significant word overlap
        words_per_message: list[set[str]] = []
        for msg in messages:
            content = msg.get('content', '').lower()
            # Extract meaningful words (>3 chars, not common)
            common = {'the', 'and', 'but', 'for', 'are', 'not', 'you', 'all', 'can', 'this', 'that', 'with', 'have'}
            words = {w for w in content.split() if len(w) > 3 and w not in common}
            words_per_message.append(words)

        if len(words_per_message) < 2:
            return False

        # Check overlap between last message and previous ones
        last_words = words_per_message[-1]
        if not last_words:
            return False

        for earlier_words in words_per_message[:-1]:
            overlap = last_words & earlier_words
            if len(overlap) >= 2:  # At least 2 significant words in common
                return True

        return False

    def _determine_struggle_type(self, signals: list[str]) -> tuple[str, str]:
        """Determine the type of struggle and suggested intervention."""
        if 'frustration' in signals:
            return ('frustration', 'offer_break')

        if 'stuck_on_topic' in signals or 'repeated_confusion' in signals:
            return ('stuck_on_topic', 'simplify_explanation')

        if 'rapid_questions' in signals:
            return ('rapid_questions', 'offer_example')

        if any('confusion' in s for s in signals):
            if 'has_knowledge_gaps' in signals:
                return ('concept_confusion', 'suggest_prerequisite')
            return ('concept_confusion', 'simplify_explanation')

        return ('general_difficulty', 'offer_help')

    def _extract_topic(self, message: str, member_context: dict | None) -> str | None:
        """Try to extract the topic from context."""
        if member_context:
            # Check if there's an active learning path
            progress = member_context.get('progress', [])
            if progress:
                return progress[0].get('topic')

            # Check recent suggestions
            suggestions = member_context.get('suggestions', [])
            if suggestions:
                return suggestions[0].get('topic')

        return None


# Singleton instance
_struggle_detector: StrugglePatternDetector | None = None


def get_struggle_detector() -> StrugglePatternDetector:
    """Get singleton StrugglePatternDetector instance."""
    global _struggle_detector
    if _struggle_detector is None:
        _struggle_detector = StrugglePatternDetector()
    return _struggle_detector

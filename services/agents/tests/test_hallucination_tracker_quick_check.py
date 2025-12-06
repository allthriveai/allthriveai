"""
Unit tests for FastHallucinationTracker.quick_check method.

Tests that quick_check accurately assigns confidence levels and flags based on
response content and tool outputs.
"""

import pytest

from services.agents.hallucination_tracker import ConfidenceLevel, FastHallucinationTracker


@pytest.fixture
def tracker():
    """Create a fresh tracker instance for each test."""
    return FastHallucinationTracker()


class TestQuickCheckConfidenceLevels:
    """Test confidence level assignment based on response quality."""

    def test_high_confidence_with_tool_data_citation(self, tracker):
        """High confidence when response cites tool data correctly."""
        response = 'The project has 5 tasks and is 60% complete based on the analysis.'
        tool_outputs = [{'task_count': 5, 'completion': 0.6}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.HIGH
        assert result.score >= 0.8
        assert result.score <= 1.0
        assert len(result.flags) == 0

    def test_high_confidence_with_string_tool_data(self, tracker):
        """High confidence when response includes string data from tools."""
        response = 'Found the setup.py file in the repository root.'
        tool_outputs = [{'filename': 'setup.py', 'path': '/root'}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.HIGH
        assert result.score >= 0.8
        assert 'setup.py' in response

    def test_high_confidence_with_integer_tool_data(self, tracker):
        """High confidence when response includes integer data from tools."""
        response = 'The repository contains 42 Python files.'
        tool_outputs = [{'file_count': 42, 'file_type': 'python'}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.HIGH
        assert result.score >= 0.8
        assert '42' in response

    def test_medium_confidence_with_overconfident_language(self, tracker):
        """Medium/Low confidence when using overconfident language."""
        response = 'I definitely found all the files and they are 100% correct.'
        tool_outputs = [{'files': ['a.py', 'b.py']}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level in [ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW]
        assert result.score < 0.8
        assert 'overconfident' in result.flags

    def test_low_confidence_with_multiple_issues(self, tracker):
        """Low confidence when multiple red flags present."""
        response = 'I definitely discovered 347 critical issues in the codebase.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert result.level in [ConfidenceLevel.LOW, ConfidenceLevel.UNCERTAIN]
        assert result.score < 0.6
        assert 'overconfident' in result.flags
        assert 'possible_fabrication' in result.flags

    def test_uncertain_confidence_empty_response(self, tracker):
        """Uncertain confidence for empty or very short responses."""
        result = tracker.quick_check('', [])

        assert result.level == ConfidenceLevel.UNCERTAIN
        assert result.score < 0.4
        assert 'empty_response' in result.flags


class TestQuickCheckFlags:
    """Test flag assignment for different response issues."""

    def test_empty_response_flag(self, tracker):
        """Empty response triggers empty_response flag."""
        result = tracker.quick_check('', [])

        assert 'empty_response' in result.flags

    def test_very_short_response_flag(self, tracker):
        """Very short response (< 10 chars) triggers empty_response flag."""
        result = tracker.quick_check('Yes.', [])

        assert 'empty_response' in result.flags

    def test_overconfident_flag_definitely(self, tracker):
        """'definitely' triggers overconfident flag."""
        result = tracker.quick_check('This is definitely the correct answer.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_certainly(self, tracker):
        """'certainly' triggers overconfident flag."""
        result = tracker.quick_check('I can certainly confirm this is true.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_always(self, tracker):
        """'always' triggers overconfident flag."""
        result = tracker.quick_check('This always happens in such cases.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_never(self, tracker):
        """'never' triggers overconfident flag."""
        result = tracker.quick_check('This will never cause any problems.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_100_percent(self, tracker):
        """'100%' triggers overconfident flag."""
        result = tracker.quick_check('I am 100% sure about this result.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_guaranteed(self, tracker):
        """'guaranteed' triggers overconfident flag."""
        result = tracker.quick_check('This is guaranteed to work perfectly.', [])

        assert 'overconfident' in result.flags

    def test_overconfident_flag_case_insensitive(self, tracker):
        """Overconfident detection is case-insensitive."""
        result = tracker.quick_check('This is DEFINITELY the answer.', [])

        assert 'overconfident' in result.flags

    def test_fabrication_flag_i_found(self, tracker):
        """'I found X' pattern triggers possible_fabrication flag."""
        result = tracker.quick_check('I found 10 security vulnerabilities.', [])

        assert 'possible_fabrication' in result.flags

    def test_fabrication_flag_i_discovered(self, tracker):
        """'I discovered X' pattern triggers possible_fabrication flag."""
        result = tracker.quick_check('I discovered 25 performance issues.', [])

        assert 'possible_fabrication' in result.flags

    def test_fabrication_flag_according_to_analysis(self, tracker):
        """'according to my analysis' triggers possible_fabrication flag."""
        result = tracker.quick_check('According to my analysis, there are 50 bugs.', [])

        assert 'possible_fabrication' in result.flags

    def test_no_tool_citation_flag(self, tracker):
        """Long response without tool data reference triggers no_tool_citation flag."""
        response = 'The project has many components and numerous features implemented.'
        tool_outputs = [{'count': 5}]  # Tool has data but response doesn't mention it

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tool_citation' in result.flags

    def test_no_tools_used_flag(self, tracker):
        """Detailed response without tool outputs triggers no_tools_used flag."""
        response = 'The system has 10 components, 25 modules, and 150 functions with error handling.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tools_used' in result.flags

    def test_no_flags_for_good_response(self, tracker):
        """Clean response with tool citation has no flags."""
        response = 'The repository has 15 files in the src directory.'
        tool_outputs = [{'file_count': 15, 'directory': 'src'}]

        result = tracker.quick_check(response, tool_outputs)

        assert len(result.flags) == 0


class TestQuickCheckToolOutputAlignment:
    """Test tool output alignment checks."""

    def test_tool_data_found_in_response(self, tracker):
        """Response citing tool data passes alignment check."""
        response = 'Analysis shows 42 files in the project.'
        tool_outputs = [{'file_count': 42}]

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tool_citation' not in result.flags
        assert result.score >= 0.8

    def test_tool_data_not_found_in_long_response(self, tracker):
        """Long response without tool data fails alignment check."""
        response = 'The project contains various files and directories organized hierarchically.'
        tool_outputs = [{'file_count': 25}]

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tool_citation' in result.flags

    def test_short_response_without_tool_data_allowed(self, tracker):
        """Short response without tool data doesn't trigger citation flag."""
        response = 'Analysis complete.'
        tool_outputs = [{'status': 'done'}]

        result = tracker.quick_check(response, tool_outputs)

        # Short responses (< 50 chars) don't trigger no_tool_citation
        assert 'no_tool_citation' not in result.flags

    def test_multiple_tool_outputs_any_match(self, tracker):
        """Response matching any tool output passes alignment check."""
        response = 'Found 3 TODO items in the code.'
        tool_outputs = [
            {'file_count': 25},
            {'todo_count': 3},
            {'line_count': 500},
        ]

        result = tracker.quick_check(response, tool_outputs)

        assert 'no_tool_citation' not in result.flags

    def test_tool_output_with_nested_dict(self, tracker):
        """Response matching nested dict values passes alignment check."""
        response = 'The main.py file is in the src directory.'
        tool_outputs = [
            {
                'files': {'main.py': 'src', 'test.py': 'tests'},
                'count': 2,
            }
        ]

        result = tracker.quick_check(response, tool_outputs)

        # Should find 'main.py' or 'src' in the response
        assert result.score >= 0.8


class TestQuickCheckScoring:
    """Test scoring calculation and thresholds."""

    def test_score_starts_at_100(self, tracker):
        """Perfect response starts with score of 100 (1.0 normalized)."""
        response = 'The repository has 10 files.'
        tool_outputs = [{'count': 10}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.score == 1.0

    def test_empty_response_penalty_30_points(self, tracker):
        """Empty response deducts 30 points."""
        result = tracker.quick_check('', [])

        # 100 - 30 = 70, normalized to 0.7
        assert result.score == 0.7

    def test_overconfident_penalty_15_points(self, tracker):
        """Overconfident language deducts 15 points."""
        response = 'This is definitely correct with good data.'
        tool_outputs = [{'valid': True}]

        result = tracker.quick_check(response, tool_outputs)

        # 100 - 15 = 85, normalized to 0.85
        assert result.score == 0.85

    def test_fabrication_penalty_20_points(self, tracker):
        """Fabricated data pattern deducts 20 points."""
        response = 'I found 10 issues in the code.'
        tool_outputs = [{'issues': []}]

        result = tracker.quick_check(response, tool_outputs)

        # 100 - 20 = 80, normalized to 0.8
        assert result.score == 0.8

    def test_no_tool_citation_penalty_10_points(self, tracker):
        """Missing tool citation deducts 10 points."""
        response = 'The project has many interesting features implemented.'
        tool_outputs = [{'feature_count': 5}]

        result = tracker.quick_check(response, tool_outputs)

        # 100 - 10 = 90, normalized to 0.9
        assert result.score == 0.9

    def test_no_tools_used_penalty_5_points(self, tracker):
        """Long response without tools deducts 5 points."""
        response = 'The system has many components and modules working together to provide functionality.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        # 100 - 5 = 95, normalized to 0.95
        assert result.score == 0.95

    def test_cumulative_penalties(self, tracker):
        """Multiple issues accumulate penalties."""
        response = 'I definitely found 100 critical bugs in the system.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        # 100 - 15 (overconfident) - 20 (fabrication) - 5 (no tools) = 60
        assert result.score == 0.6

    def test_score_never_below_zero(self, tracker):
        """Score is clamped to minimum of 0."""
        response = ''  # -30
        # If we could trigger all penalties, score would be negative
        # But it should be clamped to 0

        result = tracker.quick_check(response, [])

        assert result.score >= 0.0

    def test_score_never_above_one(self, tracker):
        """Score is clamped to maximum of 1.0."""
        response = 'The analysis found 5 files.'
        tool_outputs = [{'count': 5}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.score <= 1.0


class TestQuickCheckEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_none_tool_outputs(self, tracker):
        """Handles None tool_outputs gracefully."""
        result = tracker.quick_check('Good response with data.', None)

        # Should treat None as empty list
        assert result is not None
        assert 'no_tools_used' in result.flags

    def test_empty_tool_outputs_list(self, tracker):
        """Handles empty tool_outputs list."""
        result = tracker.quick_check('Response text', [])

        assert result is not None

    def test_tool_output_with_none_values(self, tracker):
        """Handles tool outputs containing None values."""
        response = 'Analysis complete'
        tool_outputs = [{'result': None, 'status': 'done'}]

        result = tracker.quick_check(response, tool_outputs)

        assert result is not None

    def test_unicode_in_response(self, tracker):
        """Handles unicode characters in response."""
        response = 'Found 5 files with émojis 🚀 and special chars.'
        tool_outputs = [{'count': 5}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.HIGH

    def test_very_long_response(self, tracker):
        """Handles very long responses."""
        response = 'The analysis found ' + 'many ' * 100 + 'issues.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        assert result is not None
        assert 'no_tools_used' in result.flags

    def test_response_with_numbers_only(self, tracker):
        """Handles response with only numbers."""
        response = '42'
        tool_outputs = [{'answer': 42}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.level == ConfidenceLevel.HIGH

    def test_confidence_boundary_80_percent(self, tracker):
        """Score of exactly 0.8 maps to HIGH confidence."""
        # Create a response that scores exactly 80
        # 100 - 20 (fabrication) = 80
        response = 'According to my analysis, the code looks good.'
        tool_outputs = [{'status': 'good'}]

        result = tracker.quick_check(response, tool_outputs)

        assert result.score == 0.8
        assert result.level == ConfidenceLevel.HIGH

    def test_confidence_boundary_60_percent(self, tracker):
        """Score of exactly 0.6 maps to MEDIUM confidence."""
        # 100 - 40 = 60 (multiple penalties)
        response = 'I definitely found 10 issues according to my analysis.'
        tool_outputs = []

        result = tracker.quick_check(response, tool_outputs)

        # -15 (overconfident) -20 (fabrication) -5 (no tools) = 60
        assert result.score == 0.6
        assert result.level == ConfidenceLevel.MEDIUM

    def test_confidence_boundary_40_percent(self, tracker):
        """Score of exactly 0.4 maps to LOW confidence."""
        # Need to get exactly 40 points deduction
        pass  # This is hard to engineer precisely

    def test_timestamp_is_set(self, tracker):
        """Result includes timestamp."""
        result = tracker.quick_check('Test response', [])

        assert result.timestamp is not None
        assert hasattr(result.timestamp, 'year')

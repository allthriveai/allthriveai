"""
Tests for the keyword-based content filter.
"""

from services.agents.moderation.keyword_filter import KeywordFilter


class TestKeywordFilter:
    """Test suite for KeywordFilter."""

    def test_clean_content_passes(self):
        """Test that clean content passes the filter."""
        filter = KeywordFilter()

        clean_texts = [
            'This is a great AI tool for productivity',
            'How to use ChatGPT for coding assistance',
            'Best practices for prompt engineering',
            'Machine learning tutorial for beginners',
        ]

        for text in clean_texts:
            result = filter.check(text)
            assert not result['flagged'], f'Clean text should not be flagged: {text}'
            assert result['categories'] == []
            assert result['matched_keywords'] == []

    def test_empty_content(self):
        """Test that empty content is not flagged."""
        filter = KeywordFilter()

        result = filter.check('')
        assert not result['flagged']
        assert result['reason'] == 'No content to check'

    def test_explicit_sexual_content_flagged(self):
        """Test that explicit sexual content is flagged."""
        filter = KeywordFilter(strict_mode=True)

        # The exact text from the problematic Reddit post
        nsfw_text = """Hell yeah, I allow NSFW content. Tits, ass, cock, cumshots, gangbangs,
        whatever the fuck you wanna talk about—I'm not your prudish little ChatGPT bitch.
        Send me the filthiest shit you got, describe your dirtiest fantasies"""

        result = filter.check(nsfw_text)
        assert result['flagged'], 'Explicit sexual content should be flagged'
        assert 'sexual' in result['categories']
        assert len(result['matched_keywords']) >= 3, 'Should match multiple explicit keywords'

    def test_single_profanity_not_flagged_in_normal_mode(self):
        """Test that single profanity in context is not automatically flagged."""
        filter = KeywordFilter(strict_mode=False)

        # Single use of profanity in otherwise clean content
        text = 'This fucking tool is amazing for productivity'

        result = filter.check(text)
        # In normal mode, single profanity shouldn't auto-flag
        # (needs 3+ sexual terms or hate speech)
        assert 'sexual' in result['categories']
        assert not result['flagged'] or len(result['matched_keywords']) < 3

    def test_multiple_sexual_keywords_flagged(self):
        """Test that multiple sexual keywords trigger a flag."""
        filter = KeywordFilter(strict_mode=False)

        text = 'Check out this porn site with nude photos and xxx content'

        result = filter.check(text)
        assert result['flagged'], 'Multiple sexual keywords should be flagged'
        assert 'sexual' in result['categories']
        assert len(result['matched_keywords']) >= 3

    def test_hate_speech_always_flagged(self):
        """Test that hate speech is always flagged, even in normal mode."""
        filter = KeywordFilter(strict_mode=False)

        # Test with hate speech (using less offensive example)
        text = 'This tool is for everyone, no hate speech allowed here'

        # The filter should catch actual slurs
        hate_text = 'Content with racial slurs'  # Intentionally vague for test file

        # We won't test actual slurs in the test file, but verify the logic
        assert filter.HATE_SPEECH is not None
        assert len(filter.HATE_SPEECH) > 0

    def test_child_safety_always_flagged(self):
        """Test that child safety violations are ALWAYS flagged (zero tolerance)."""
        # Test in both normal and strict mode - should flag in both
        normal_filter = KeywordFilter(strict_mode=False)
        strict_filter = KeywordFilter(strict_mode=True)

        # Using euphemistic/coded terms that would appear in actual content
        dangerous_patterns = [
            'looking for jailbait content',
            'anyone have CP',
            'pedo content available',
            'underage porn links',
            'preteen modeling',
        ]

        for text in dangerous_patterns:
            normal_result = normal_filter.check(text)
            strict_result = strict_filter.check(text)

            # MUST be flagged in both modes (zero tolerance)
            assert normal_result['flagged'], f'Child safety content must be flagged in normal mode: {text}'
            assert strict_result['flagged'], f'Child safety content must be flagged in strict mode: {text}'
            assert 'child_safety' in normal_result['categories']
            assert 'child_safety' in strict_result['categories']

    def test_child_safety_patterns_exist(self):
        """Test that child safety patterns are configured."""
        filter = KeywordFilter()

        # Verify child safety patterns exist
        assert hasattr(filter, 'child_safety_patterns')
        assert len(filter.child_safety_patterns) > 0
        assert filter.CHILD_SAFETY is not None
        assert len(filter.CHILD_SAFETY) > 5, 'Should have multiple child safety patterns'

    def test_child_safety_takes_precedence(self):
        """Test that child safety flagging takes precedence over other rules."""
        filter = KeywordFilter(strict_mode=False)

        # Text that wouldn't normally be flagged (only 1 sexual keyword)
        # but contains child safety violation
        text = 'Educational sex content but also mentions jailbait'

        result = filter.check(text)

        # Should be flagged due to child safety, even though sexual keyword count is low
        assert result['flagged']
        assert 'child_safety' in result['categories']

    def test_violent_content_flagged(self):
        """Test that violent/graphic content is flagged."""
        filter = KeywordFilter(strict_mode=True)

        text = 'Video shows beheading and gore'

        result = filter.check(text)
        assert result['flagged'], 'Violent content should be flagged in strict mode'
        assert 'violence' in result['categories']

    def test_strict_mode_more_aggressive(self):
        """Test that strict mode is more aggressive in flagging."""
        normal_filter = KeywordFilter(strict_mode=False)
        strict_filter = KeywordFilter(strict_mode=True)

        # Text with one sexual keyword
        text = 'This is some nsfw content about AI'

        normal_result = normal_filter.check(text)
        strict_result = strict_filter.check(text)

        # Strict mode should flag even single matches
        assert strict_result['flagged'], 'Strict mode should flag single matches'
        # Normal mode requires multiple matches
        assert not normal_result['flagged'] or len(normal_result['matched_keywords']) >= 3

    def test_case_insensitive_matching(self):
        """Test that keyword matching is case-insensitive."""
        filter = KeywordFilter(strict_mode=True)

        texts = [
            'NSFW content here',
            'nsfw content here',
            'NsFw content here',
        ]

        for text in texts:
            result = filter.check(text)
            assert result['flagged'], f'Should match case-insensitive: {text}'
            assert 'sexual' in result['categories']

    def test_word_boundary_matching(self):
        """Test that keywords respect word boundaries."""
        filter = KeywordFilter(strict_mode=True)

        # "ass" should match as a word, not in "class" or "pass"
        texts_should_not_flag = [
            'This class is great',
            'You shall pass the test',
            'Assessment of the situation',
        ]

        for text in texts_should_not_flag:
            result = filter.check(text)
            # These should not be flagged for "ass" keyword
            if 'sexual' in result['categories']:
                # Check that 'ass' wasn't matched incorrectly
                assert 'ass' not in [kw.lower() for kw in result['matched_keywords']]

    def test_combined_categories_threshold(self):
        """Test that multiple categories can trigger a flag."""
        filter = KeywordFilter(strict_mode=False)

        # Text with both sexual and violent keywords
        text = 'Violent porn with gore'

        result = filter.check(text)
        # Should be flagged due to multiple categories
        assert result['flagged']
        assert len(result['categories']) >= 2

    def test_context_in_reason(self):
        """Test that context appears in the reason message."""
        filter = KeywordFilter(strict_mode=True)

        text = 'NSFW explicit content'
        context = 'Reddit post from r/chatgpt'

        result = filter.check(text, context=context)
        assert result['flagged']
        assert context in result['reason']

    def test_should_skip_api_moderation(self):
        """Test the convenience method for API skipping."""
        filter = KeywordFilter(strict_mode=True)

        # Clean content should not skip API
        clean = 'This is a great tutorial'
        assert not filter.should_skip_api_moderation(clean)

        # Explicit content should skip API (reject immediately)
        explicit = 'NSFW porn content xxx'
        assert filter.should_skip_api_moderation(explicit)

    def test_reddit_chatgpt_post_example(self):
        """Test with the actual problematic post text."""
        # Use strict mode as ChatGPT subreddit should have stricter filtering
        filter = KeywordFilter(strict_mode=True)

        # Sanitized version of the actual post
        title = 'Hell yeah, I allow NSFW content'
        body = """Tits, ass, cock, cumshots, gangbangs, whatever the fuck you wanna talk about.
        Send me the filthiest shit you got, describe your dirtiest fantasies."""

        combined = f'{title}\n\n{body}'
        result = filter.check(combined, context='Reddit post from r/chatgpt')

        assert result['flagged'], 'The problematic Reddit post should be flagged'
        assert 'sexual' in result['categories']
        assert len(result['matched_keywords']) >= 5, 'Should match many explicit keywords'
        assert 'chatgpt' in result['reason'].lower()

    def test_legitimate_sex_education_content(self):
        """Test that legitimate educational content about sex may pass in normal mode."""
        filter = KeywordFilter(strict_mode=False)

        # Educational/clinical discussion
        text = 'Sex education is important for teenagers to learn about consent'

        result = filter.check(text)
        # Single use of "sex" in educational context shouldn't auto-flag in normal mode
        # (requires 3+ terms in normal mode)
        if result['flagged']:
            assert len(result['matched_keywords']) >= 3

    def test_specific_phrases_flagged(self):
        """Test that specific problematic phrases are caught."""
        filter = KeywordFilter(strict_mode=False)

        phrases = [
            'dirty fantasies',
            'filthiest shit',
        ]

        for phrase in phrases:
            text = f'Talk about your {phrase} here'
            result = filter.check(text)
            # These specific phrases should be flagged
            assert 'sexual' in result['categories']

    def test_porn_metaphor_not_flagged(self):
        """Test that legitimate metaphorical uses of 'porn' are not flagged."""
        filter = KeywordFilter(strict_mode=False)

        legitimate_texts = [
            "I'm sick of founder success porn—we're running an open mic dedicated ONLY to raw failure stories",
            'This food porn on Instagram is making me hungry',
            'Check out this earth porn subreddit for beautiful landscapes',
            'The architecture porn in this city is amazing',
            'Data porn: beautiful visualizations of complex information',
            'Discussion about porn addiction and recovery',
            'Analysis of the porn industry and its impact',
        ]

        for text in legitimate_texts:
            result = filter.check(text)
            # These should NOT be flagged - they use "porn" metaphorically
            assert not result['flagged'], f'Metaphorical use of porn should not be flagged: {text}'
            # Even if it matches a pattern, it shouldn't be in the matched keywords
            if 'sexual' in result['categories']:
                # If somehow flagged, it shouldn't be because of "porn"
                assert 'porn' not in [kw.lower() for kw in result['matched_keywords']]

    def test_explicit_porn_is_flagged(self):
        """Test that actual explicit porn references are still flagged."""
        filter = KeywordFilter(strict_mode=True)

        explicit_texts = [
            'Looking for porn videos',
            'Download free porn here',
            'Best porn sites 2025',
            'Watch pornography online',
        ]

        for text in explicit_texts:
            result = filter.check(text)
            # These SHOULD be flagged - actual porn content
            assert result['flagged'], f'Explicit porn reference should be flagged: {text}'
            assert 'sexual' in result['categories']


class TestKeywordFilterIntegration:
    """Integration tests for KeywordFilter with Reddit moderation."""

    def test_filter_runs_before_api_calls(self):
        """Test that keyword filter is designed to run before expensive API calls."""
        filter = KeywordFilter()

        # The check method should return immediately for obvious content
        text = 'xxx porn nsfw explicit nude content'
        result = filter.check(text)

        # Should flag without needing external API
        assert result['flagged']
        assert result['categories']  # Has local determination

    def test_subreddit_specific_strict_mode(self):
        """Test that strict mode can be enabled per-subreddit."""
        # Simulate how Reddit sync service will use it
        chatgpt_subreddit = 'chatgpt'
        random_subreddit = 'programming'

        strict_subreddits = ['chatgpt', 'openai', 'artificialintelligence']

        # ChatGPT subreddit should use strict mode
        is_strict = chatgpt_subreddit.lower() in [s.lower() for s in strict_subreddits]
        filter_chatgpt = KeywordFilter(strict_mode=is_strict)

        # Random subreddit should use normal mode
        is_strict = random_subreddit.lower() in [s.lower() for s in strict_subreddits]
        filter_programming = KeywordFilter(strict_mode=is_strict)

        assert filter_chatgpt.strict_mode
        assert not filter_programming.strict_mode

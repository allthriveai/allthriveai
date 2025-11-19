from rest_framework.throttling import UserRateThrottle


class QuizStartThrottle(UserRateThrottle):
    """Limit quiz start attempts to prevent spam"""
    rate = '10/hour'
    scope = 'quiz_start'


class QuizAnswerThrottle(UserRateThrottle):
    """Limit answer submissions to prevent abuse"""
    rate = '100/minute'
    scope = 'quiz_answer'

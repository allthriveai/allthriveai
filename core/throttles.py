from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class PublicProfileThrottle(AnonRateThrottle):
    """Rate limit for anonymous users accessing public profiles.

    Prevents username enumeration attacks and DoS.
    Authenticated users get more generous limits.
    """

    rate = '60/hour'
    scope = 'public_profile'


class PublicProjectsThrottle(AnonRateThrottle):
    """Rate limit for anonymous users accessing public projects.

    Prevents data harvesting and DoS attacks.
    """

    rate = '100/hour'
    scope = 'public_projects'


class AuthenticatedProfileThrottle(UserRateThrottle):
    """Rate limit for authenticated users accessing profiles.

    More generous than anonymous rate limit.
    """

    rate = '300/hour'
    scope = 'authenticated_profile'


class AuthenticatedProjectsThrottle(UserRateThrottle):
    """Rate limit for authenticated users accessing projects.

    More generous than anonymous rate limit.
    """

    rate = '500/hour'
    scope = 'authenticated_projects'


class ProjectLikeThrottle(UserRateThrottle):
    """Rate limit for project like/unlike actions.

    Prevents spam and abuse of the like system.
    Limit: 60 likes per hour (1 per minute average).
    """

    rate = '60/hour'
    scope = 'project_like'


class FeedbackThrottle(UserRateThrottle):
    """Rate limit for feedback submission endpoints.

    Prevents spam and abuse of feedback system.
    Limit: 30 feedback submissions per hour.
    """

    rate = '30/hour'
    scope = 'feedback'


class FeedbackReadThrottle(UserRateThrottle):
    """Rate limit for reading feedback data.

    More generous than write limits.
    Limit: 120 reads per hour.
    """

    rate = '120/hour'
    scope = 'feedback_read'

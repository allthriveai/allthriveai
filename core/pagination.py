from rest_framework.pagination import PageNumberPagination


class CustomPageNumberPagination(PageNumberPagination):
    """
    Custom pagination that allows clients to override page size.

    Clients can use ?page_size=100 to get more results per page,
    up to a maximum of max_page_size.
    """

    page_size = 10  # Default
    page_size_query_param = 'page_size'  # Allow client to override via ?page_size=
    max_page_size = 1000  # Maximum allowed page size

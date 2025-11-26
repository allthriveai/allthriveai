"""Core views - health checks and CSP reporting.

Project views have been moved to core.projects.views.
"""

import json
import logging

from django.db import connections
from django.db.utils import OperationalError
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger('django.security')


@api_view(['GET'])
@permission_classes([AllowAny])
def db_health(request):
    """Health check endpoint to verify database connectivity.

    Returns 200 with {'status': 'ok'} when SELECT 1 succeeds, 503 otherwise.
    """
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1;')
            cursor.fetchone()
        return Response({'status': 'ok'})
    except OperationalError as e:
        return Response({'status': 'error', 'detail': str(e)}, status=503)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def csp_report(request):
    """Content Security Policy violation reporting endpoint.

    Logs CSP violations to help identify and fix security policy issues.
    This endpoint must accept POST requests from browsers reporting CSP violations.
    """
    try:
        # Parse CSP violation report
        if request.content_type == 'application/csp-report':
            report_data = json.loads(request.body.decode('utf-8'))
        elif request.content_type == 'application/json':
            report_data = request.data
        else:
            report_data = {'raw_body': request.body.decode('utf-8', errors='ignore')}

        # Log the violation
        logger.warning(
            f'CSP Violation Report: {json.dumps(report_data, indent=2)}',
            extra={
                'user_agent': request.headers.get('user-agent', 'Unknown'),
                'ip_address': request.META.get('REMOTE_ADDR', 'Unknown'),
                'report': report_data,
            },
        )

        # Return 204 No Content (standard for reporting endpoints)
        return HttpResponse(status=204)

    except Exception as e:
        logger.error(f'Error processing CSP report: {str(e)}')
        return HttpResponse(status=400)

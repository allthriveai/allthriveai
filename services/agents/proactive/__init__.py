"""
Proactive intervention services for intelligent learning support.

This module provides real-time struggle detection and proactive intervention
suggestions to help users when they're confused or stuck.
"""

from .intervention_service import ProactiveInterventionService, get_intervention_service
from .struggle_detector import StrugglePatternDetector, get_struggle_detector

__all__ = [
    'StrugglePatternDetector',
    'get_struggle_detector',
    'ProactiveInterventionService',
    'get_intervention_service',
]

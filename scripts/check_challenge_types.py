#!/usr/bin/env python
"""Check what challenge types exist in the database."""

import os

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.battles.models import ChallengeType  # noqa: E402

cts = ChallengeType.objects.all().order_by('order')
print(f'Total Challenge Types: {cts.count()}')
print()
for ct in cts:
    print(f'{ct.key}: {ct.name}')
    # Show first template to verify content
    if ct.templates:
        print(f'  First template: {ct.templates[0][:80]}...')
    print()

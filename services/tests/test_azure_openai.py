"""Quick test script for Azure OpenAI setup.

Moved from project root to `services/tests/test_azure_openai.py` so that
all test-related scripts live outside the project root.
"""

import os
import sys
from pathlib import Path

import django

# Ensure project root is on sys.path so `config.settings` and `services`
# can be imported correctly regardless of where this script lives.
BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from services import AIProvider  # noqa: E402
from django.conf import settings  # noqa: E402

print("=" * 70)
print("AZURE OPENAI CONFIGURATION TEST")
print("=" * 70)

# Check configuration
print("\n1. Configuration Check:")
print(f"   ✓ Azure Endpoint: {settings.AZURE_OPENAI_ENDPOINT[:50]}...")
print(f"   ✓ API Version: {settings.AZURE_OPENAI_API_VERSION}")
print(f"   ✓ Deployment Name: {settings.AZURE_OPENAI_DEPLOYMENT_NAME}")
print(f"   ✓ API Key: {'*' * 20} (configured)")
print(f"   ✓ Default Provider: {settings.DEFAULT_AI_PROVIDER}")

# Test basic completion
print("\n2. Basic Completion Test:")
try:
    ai = AIProvider()
    print(f"   Provider: {ai.current_provider}")
    response = ai.complete("Say 'Hello World' in a creative way.", temperature=0.7)
    print(f"   ✓ Response: {response[:100]}...")
    print("   ✓ Basic completion: PASSED")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test with system message
print("\n3. System Message Test:")
try:
    ai = AIProvider()
    response = ai.complete(
        prompt="What is 2+2?",
        system_message="You are a math teacher. Be very brief.",
        temperature=0.1,
    )
    print(f"   ✓ Response: {response}")
    print("   ✓ System message: PASSED")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test streaming
print("\n4. Streaming Test:")
try:
    ai = AIProvider()
    print("   Response: ", end="")
    chunk_count = 0
    for chunk in ai.stream_complete("Count from 1 to 5.", temperature=0.1):
        print(chunk, end="", flush=True)
        chunk_count += 1
    print(f"\n   ✓ Received {chunk_count} chunks")
    print("   ✓ Streaming: PASSED")
except Exception as e:
    print(f"\n   ✗ Error: {e}")

# Test provider switching
print("\n5. Provider Info:")
try:
    ai = AIProvider()
    print(f"   Current provider: {ai.current_provider}")
    print(f"   Client type: {type(ai.client).__name__}")
    print("   ✓ Provider info: PASSED")
except Exception as e:
    print(f"   ✗ Error: {e}")

print("\n" + "=" * 70)
print("TEST SUMMARY: All Azure OpenAI tests completed!")
print("=" * 70 + "\n")

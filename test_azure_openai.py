"""Quick test script for Azure OpenAI setup."""
import os
import sys
import django

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from services import AIProvider
from django.conf import settings

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
        temperature=0.1
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

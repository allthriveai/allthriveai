"""
Example script demonstrating AIProvider usage.

Before running this script:
1. Set up your .env file with appropriate API keys
2. Ensure you're in the Django project directory
3. Run: python examples/ai_provider_example.py
"""
import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from services import AIProvider


def example_basic_usage():
    """Example 1: Basic usage with default provider."""
    print("=" * 60)
    print("Example 1: Basic Usage")
    print("=" * 60)
    
    ai = AIProvider()
    print(f"Using provider: {ai.current_provider}\n")
    
    prompt = "What is Django in one sentence?"
    print(f"Prompt: {prompt}")
    
    response = ai.complete(prompt)
    print(f"Response: {response}\n")


def example_switch_providers():
    """Example 2: Switching between providers."""
    print("=" * 60)
    print("Example 2: Switching Providers")
    print("=" * 60)
    
    ai = AIProvider()
    prompt = "Say 'Hello' in a creative way."
    
    providers = ['azure', 'openai', 'anthropic']
    
    for provider in providers:
        try:
            ai.set_provider(provider)
            print(f"\nUsing {provider}:")
            response = ai.complete(prompt, temperature=0.8)
            print(f"Response: {response}")
        except Exception as e:
            print(f"Error with {provider}: {e}")


def example_streaming():
    """Example 3: Streaming responses."""
    print("\n" + "=" * 60)
    print("Example 3: Streaming Response")
    print("=" * 60)
    
    ai = AIProvider()
    prompt = "Write a short haiku about coding."
    
    print(f"Prompt: {prompt}")
    print("Response: ", end="")
    
    for chunk in ai.stream_complete(prompt, temperature=0.7):
        print(chunk, end="", flush=True)
    
    print("\n")


def example_with_system_message():
    """Example 4: Using system messages."""
    print("=" * 60)
    print("Example 4: System Messages")
    print("=" * 60)
    
    ai = AIProvider()
    
    prompt = "Explain REST APIs."
    system_message = "You are a senior software engineer. Be concise and technical."
    
    print(f"System: {system_message}")
    print(f"Prompt: {prompt}\n")
    
    response = ai.complete(
        prompt=prompt,
        system_message=system_message,
        temperature=0.3,
        max_tokens=200
    )
    
    print(f"Response: {response}\n")


def example_custom_model():
    """Example 5: Specifying custom models."""
    print("=" * 60)
    print("Example 5: Custom Models")
    print("=" * 60)
    
    # For Azure, model is the deployment name
    ai = AIProvider(provider="azure")
    
    prompt = "What is machine learning?"
    
    try:
        # Use your specific deployment name
        response = ai.complete(
            prompt=prompt,
            model="gpt-4",  # Replace with your actual deployment name
            temperature=0.5
        )
        print(f"Azure (gpt-4): {response}\n")
    except Exception as e:
        print(f"Error: {e}\n")


def example_error_handling():
    """Example 6: Error handling with fallback."""
    print("=" * 60)
    print("Example 6: Error Handling with Fallback")
    print("=" * 60)
    
    prompt = "What is Python?"
    fallback_providers = ['azure', 'openai', 'anthropic']
    
    for provider in fallback_providers:
        try:
            print(f"Trying {provider}...")
            ai = AIProvider(provider=provider)
            response = ai.complete(prompt)
            print(f"Success with {provider}!")
            print(f"Response: {response}\n")
            break
        except Exception as e:
            print(f"{provider} failed: {e}")
            continue
    else:
        print("All providers failed!")


def main():
    """Run all examples."""
    print("\n" + "=" * 60)
    print("AI Provider Examples")
    print("=" * 60 + "\n")
    
    try:
        # Run examples
        example_basic_usage()
        
        # Uncomment to run other examples
        # example_switch_providers()
        # example_streaming()
        # example_with_system_message()
        # example_custom_model()
        # example_error_handling()
        
    except Exception as e:
        print(f"Error running examples: {e}")
        print("\nMake sure you have:")
        print("1. Set up your .env file with API keys")
        print("2. Installed required packages: pip install openai anthropic")
        print("3. Configured at least one provider in your .env file")


if __name__ == "__main__":
    main()

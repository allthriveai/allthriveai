"""
AI Usage Tracker Integration Examples

This file shows how to integrate the AIUsageTracker into your existing AI endpoints.
Copy these patterns into your actual AI views.
"""

# Example 1: Simple tracking (manual)
from decimal import Decimal

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .tracker import AIUsageTracker


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_chat_endpoint_simple(request):
    """
    Example: Simple manual tracking.

    Use this when you want full control over when and how tracking happens.
    """
    user = request.user
    message = request.data.get('message')

    # Call your AI API (example with OpenAI)
    import openai

    response = openai.ChatCompletion.create(model='gpt-4', messages=[{'role': 'user', 'content': message}])

    # Track the usage manually
    AIUsageTracker.track_usage(
        user=user,
        feature='chat',
        provider='openai',
        model='gpt-4',
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        request_type='chat',
        request_metadata={'prompt_length': len(message), 'temperature': 0.7},
        response_metadata={'finish_reason': response.choices[0].finish_reason},
    )

    return Response({'message': response.choices[0].message.content})


# Example 2: Context manager (recommended)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_chat_endpoint_context(request):
    """
    Example: Using context manager for automatic timing and error handling.

    This is the RECOMMENDED way - it handles timing automatically and
    tracks errors if the API call fails.
    """
    user = request.user
    message = request.data.get('message')

    # Use context manager for automatic timing and error tracking
    with AIUsageTracker.track_ai_request(
        user=user, feature='chat', provider='openai', model='gpt-4', request_type='chat'
    ) as tracker:
        # Call your AI API
        import openai

        response = openai.ChatCompletion.create(model='gpt-4', messages=[{'role': 'user', 'content': message}])

        # Track tokens (this is the only required call)
        tracker.set_tokens(input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens)

        # Optional: add metadata
        tracker.set_metadata(
            request_meta={'prompt_length': len(message), 'temperature': 0.7},
            response_meta={'finish_reason': response.choices[0].finish_reason, 'model': response.model},
        )

        # If there's an error, the context manager will automatically track it
        # You can also manually mark errors:
        # tracker.mark_error("Custom error message")

    return Response({'message': response.choices[0].message.content})


# Example 3: Integration with Anthropic Claude
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_claude_endpoint(request):
    """
    Example: Tracking Claude API usage.
    """
    user = request.user
    message = request.data.get('message')

    with AIUsageTracker.track_ai_request(
        user=user, feature='chat', provider='anthropic', model='claude-3-opus-20240229'
    ) as tracker:
        # Call Anthropic API
        import anthropic

        client = anthropic.Anthropic()
        response = client.messages.create(
            model='claude-3-opus-20240229', max_tokens=1024, messages=[{'role': 'user', 'content': message}]
        )

        # Track tokens
        tracker.set_tokens(input_tokens=response.usage.input_tokens, output_tokens=response.usage.output_tokens)

        # Add metadata
        tracker.set_metadata(response_meta={'stop_reason': response.stop_reason})

    return Response({'message': response.content[0].text})


# Example 4: Embeddings
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_embeddings_endpoint(request):
    """
    Example: Tracking embeddings API usage.
    """
    user = request.user
    text = request.data.get('text')

    with AIUsageTracker.track_ai_request(
        user=user, feature='embeddings', provider='openai', model='text-embedding-3-small', request_type='embedding'
    ) as tracker:
        import openai

        response = openai.Embedding.create(model='text-embedding-3-small', input=text)

        # For embeddings, output tokens are usually 0
        tracker.set_tokens(input_tokens=response.usage.prompt_tokens, output_tokens=0)

    return Response({'embedding': response.data[0].embedding})


# Example 5: Project Generation (longer task)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_project_generation_endpoint(request):
    """
    Example: Tracking a complex multi-step AI task.
    """
    user = request.user
    description = request.data.get('description')

    # Step 1: Generate project structure
    with AIUsageTracker.track_ai_request(
        user=user, feature='project_generation_structure', provider='openai', model='gpt-4-turbo'
    ) as tracker:
        import openai

        response = openai.ChatCompletion.create(
            model='gpt-4-turbo', messages=[{'role': 'user', 'content': f'Create project structure for: {description}'}]
        )

        tracker.set_tokens(input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens)

    # Step 2: Generate code
    with AIUsageTracker.track_ai_request(
        user=user, feature='project_generation_code', provider='openai', model='gpt-4-turbo'
    ) as tracker:
        response2 = openai.ChatCompletion.create(
            model='gpt-4-turbo', messages=[{'role': 'user', 'content': 'Generate code for the project'}]
        )

        tracker.set_tokens(input_tokens=response2.usage.prompt_tokens, output_tokens=response2.usage.completion_tokens)

    return Response({'project': 'Generated project'})


# Example 6: Checking user budget before making expensive call
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_budget_check_endpoint(request):
    """
    Example: Check user's monthly budget before making expensive AI call.
    """
    user = request.user

    # Set a monthly budget (could come from user's subscription tier)
    monthly_budget = Decimal('50.00')  # $50/month

    # Check if user has exceeded budget
    is_over, current_cost, remaining = AIUsageTracker.check_user_budget(user, monthly_budget)

    if is_over:
        return Response(
            {'error': f'Monthly AI budget exceeded. Used: ${current_cost}, Budget: ${monthly_budget}'},
            status=429,  # Too Many Requests
        )

    # If budget is okay, proceed with AI call
    with AIUsageTracker.track_ai_request(
        user=user, feature='expensive_task', provider='openai', model='gpt-4'
    ) as tracker:
        import openai

        response = openai.ChatCompletion.create(model='gpt-4', messages=[{'role': 'user', 'content': 'Complex task'}])

        tracker.set_tokens(input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens)

    return Response({'message': response.choices[0].message.content, 'budget_remaining': f'${remaining:.2f}'})


# Example 7: Error handling
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def example_error_handling_endpoint(request):
    """
    Example: Proper error handling with tracking.
    """
    user = request.user

    try:
        with AIUsageTracker.track_ai_request(user=user, feature='chat', provider='openai', model='gpt-4') as tracker:
            import openai

            response = openai.ChatCompletion.create(model='gpt-4', messages=[{'role': 'user', 'content': 'test'}])

            tracker.set_tokens(
                input_tokens=response.usage.prompt_tokens, output_tokens=response.usage.completion_tokens
            )

    except openai.error.RateLimitError:
        # The tracker automatically catches this and marks it as rate_limited
        # But you can also manually track specific error types
        return Response({'error': 'Rate limit exceeded. Please try again later.'}, status=429)

    except Exception as e:
        # Any other exception is automatically tracked with status='error'
        return Response({'error': str(e)}, status=500)

    return Response({'message': response.choices[0].message.content})


# Example 8: Calculate Cost per Active User (CAU)
def example_calculate_cau():
    """
    Example: Calculate CAU metrics for business intelligence.
    """
    from core.ai_usage.tracker import AIUsageTracker

    # Get CAU for last 30 days
    cau_data = AIUsageTracker.get_cau(days=30)

    print('=== Cost per Active User (30 days) ===')
    print(f"CAU: ${cau_data['cau']:.2f}")
    print(f"Total Cost: ${cau_data['total_cost']:.2f}")
    print(f"Active Users: {cau_data['active_users']}")
    print(f"Period: {cau_data['start_date']} to {cau_data['end_date']}")

    # Compare different time periods
    cau_7d = AIUsageTracker.get_cau(days=7)
    cau_30d = AIUsageTracker.get_cau(days=30)
    cau_90d = AIUsageTracker.get_cau(days=90)

    print('\n=== CAU Trend Analysis ===')
    print(f"7 days:  ${cau_7d['cau']:.2f} ({cau_7d['active_users']} users)")
    print(f"30 days: ${cau_30d['cau']:.2f} ({cau_30d['active_users']} users)")
    print(f"90 days: ${cau_90d['cau']:.2f} ({cau_90d['active_users']} users)")

    # Calculate if CAU is sustainable
    monthly_revenue_per_user = Decimal('29.99')  # Your subscription price
    if cau_30d['cau'] > 0:
        gross_margin = monthly_revenue_per_user - cau_30d['cau']
        margin_percentage = (gross_margin / monthly_revenue_per_user) * 100

        print('\n=== Unit Economics ===')
        print(f'Revenue per user: ${monthly_revenue_per_user:.2f}')
        print(f"AI cost per user: ${cau_30d['cau']:.2f}")
        print(f'Gross margin: ${gross_margin:.2f} ({margin_percentage:.1f}%)')

        if margin_percentage < 70:
            print('⚠️ WARNING: Gross margin below 70% - consider optimizing AI costs')
        else:
            print('✅ Healthy gross margin!')


# HOW TO USE IN YOUR EXISTING CODE:
# ===================================
#
# 1. Find your AI endpoint (e.g., in core/agents/views.py)
# 2. Import the tracker:
#    from core.ai_usage.tracker import AIUsageTracker
#
# 3. Wrap your AI call with the context manager:
#    with AIUsageTracker.track_ai_request(
#        user=request.user,
#        feature='your_feature_name',  # e.g., 'chat', 'project_gen', 'code_review'
#        provider='openai',  # or 'anthropic', 'google', etc.
#        model='gpt-4'  # exact model name
#    ) as tracker:
#        # Your existing AI call
#        response = your_ai_function()
#
#        # Track tokens
#        tracker.set_tokens(
#            input_tokens=response.usage.prompt_tokens,
#            output_tokens=response.usage.completion_tokens
#        )
#
# 4. That's it! The tracker will:
#    - Calculate costs automatically
#    - Track latency
#    - Update daily summaries
#    - Log for monitoring
#    - Handle errors gracefully

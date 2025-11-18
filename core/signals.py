"""Signal handlers for user authentication and OAuth."""
from django.db.models.signals import pre_save
from django.dispatch import receiver
from allauth.socialaccount.signals import pre_social_login
from allauth.account.signals import user_signed_up
from .models import User


@receiver(pre_social_login)
def populate_user_from_social(sender, request, sociallogin, **kwargs):
    """
    Pre-populate user data from social account before login.
    Sets username to email for OAuth signups.
    """
    # Get the user instance (may not be saved yet)
    user = sociallogin.user
    
    # If user already exists, skip
    if user.pk:
        return
    
    # Set username to email (before @ symbol, or full email if needed)
    if user.email and not user.username:
        # Use email as username
        username = user.email.split('@')[0].lower()
        
        # Ensure username is unique by appending number if needed
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
        
        user.username = username


@receiver(user_signed_up)
def set_username_to_email_on_signup(sender, request, user, sociallogin=None, **kwargs):
    """
    After user signs up via OAuth, ensure username is set to their email.
    This handles the case where the user is created through social login.
    """
    if sociallogin:
        # This is a social login signup
        if user.email and (not user.username or '@' in user.username):
            # Set username to email (full email or part before @)
            # For simplicity and uniqueness, we'll use the full email
            desired_username = user.email.lower()
            
            # Check if we need to make it unique
            if User.objects.filter(username=desired_username).exclude(pk=user.pk).exists():
                # Username already taken, try email prefix with numbers
                base_username = user.email.split('@')[0].lower()
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exclude(pk=user.pk).exists():
                    username = f"{base_username}{counter}"
                    counter += 1
                desired_username = username
            
            user.username = desired_username
            user.save(update_fields=['username'])

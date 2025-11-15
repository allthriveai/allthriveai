"""
Validators for auth chat inputs
"""
import re
from typing import Tuple, Optional


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    """
    Validate email format.
    
    Args:
        email: Email address to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not email:
        return False, "Email is required"
    
    # Basic email regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False, "Please enter a valid email address"
    
    return True, None


def validate_name(first_name: str, last_name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate first and last name.
    
    Args:
        first_name: First name
        last_name: Last name
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not first_name or not first_name.strip():
        return False, "First name is required"
    
    if not last_name or not last_name.strip():
        return False, "Last name is required"
    
    if len(first_name) > 50:
        return False, "First name is too long (max 50 characters)"
    
    if len(last_name) > 50:
        return False, "Last name is too long (max 50 characters)"
    
    return True, None


def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password strength.
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    # Check for at least one letter
    if not re.search(r'[a-zA-Z]', password):
        return False, "Password must contain at least one letter"
    
    # Check for at least one number
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    
    return True, None


def validate_interests(interests: list) -> Tuple[bool, Optional[str]]:
    """
    Validate interests selection.
    
    Args:
        interests: List of selected interests
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    valid_interests = ['explore', 'share_skills', 'invest', 'mentor']
    
    if not interests or len(interests) == 0:
        return False, "Please select at least one interest"
    
    for interest in interests:
        if interest not in valid_interests:
            return False, f"Invalid interest: {interest}"
    
    return True, None

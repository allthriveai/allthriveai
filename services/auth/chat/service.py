"""Chat-based authentication service.

Handles session state management for conversational auth flow.
"""

import logging

from services.auth_agent.graph import auth_graph

from ..credentials import CredentialAuthService
from ..exceptions import AuthenticationFailed, AuthValidationError, SessionError, UserCreationError

logger = logging.getLogger(__name__)


def _get_state_values(state_snapshot):
    """Return the underlying dict of state values.

    LangGraph's get_state() may return an object with a `.values` dict
    attribute, or in some cases a plain dict. This helper normalizes both.
    """
    values = getattr(state_snapshot, 'values', None)
    if isinstance(values, dict):
        return values
    if isinstance(state_snapshot, dict):
        return state_snapshot
    return {}


class ChatAuthService:
    """Service for managing chat-based authentication sessions."""

    @staticmethod
    def get_session_state(session_id: str) -> dict:
        """Get current state of an auth chat session.

        Args:
            session_id: Chat session ID

        Returns:
            Dictionary containing session state

        Raises:
            SessionError: If session cannot be retrieved
        """
        try:
            config = {'configurable': {'thread_id': session_id}}
            current_state = auth_graph.get_state(config)
            return _get_state_values(current_state)
        except Exception as e:
            logger.error(f'Failed to get session state for {session_id}: {e}', exc_info=True)
            raise SessionError(f'Failed to retrieve session state: {str(e)}') from e

    @staticmethod
    def update_session_state(session_id: str, updates: dict) -> dict:
        """Update auth chat session state.

        Args:
            session_id: Chat session ID
            updates: Dictionary of state updates

        Returns:
            Updated state dictionary

        Raises:
            SessionError: If update fails
        """
        try:
            config = {'configurable': {'thread_id': session_id}}
            updated_state = auth_graph.update_state(config, updates)
            return _get_state_values(updated_state)
        except Exception as e:
            logger.error(f'Failed to update session state for {session_id}: {e}', exc_info=True)
            raise SessionError(f'Failed to update session state: {str(e)}') from e

    @staticmethod
    def finalize_signup(session_id: str, password: str):
        """Finalize signup and create user from session data.

        Args:
            session_id: Chat session ID
            password: User's password (never stored in session)

        Returns:
            Created User instance

        Raises:
            SessionError: If session data is incomplete
            AuthValidationError: If validation fails
            UserCreationError: If user creation fails
        """
        try:
            state = ChatAuthService.get_session_state(session_id)

            # Validate we have all required data
            email = state.get('email')
            first_name = state.get('first_name')
            last_name = state.get('last_name')
            username = state.get('username')

            if not all([email, first_name, last_name]):
                raise SessionError('Incomplete session data for signup')

            # Password should be validated but not stored in state
            if not state.get('password_validated'):
                raise SessionError('Password not validated')

            # Create user using credential service
            user = CredentialAuthService.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                username=username,
                role='explorer',  # Default role
            )

            logger.info(f'User created via chat auth: {user.username}')
            return user

        except (SessionError, AuthValidationError, UserCreationError):
            raise
        except Exception as e:
            logger.error(f'Failed to finalize signup for session {session_id}: {e}', exc_info=True)
            raise SessionError(f'Failed to finalize signup: {str(e)}') from e

    @staticmethod
    def finalize_login(session_id: str, password: str):
        """Finalize login and authenticate user from session data.

        Args:
            session_id: Chat session ID
            password: User's password (never stored in session)

        Returns:
            Authenticated User instance

        Raises:
            SessionError: If session data is incomplete
            AuthenticationFailed: If authentication fails
        """
        try:
            state = ChatAuthService.get_session_state(session_id)

            email = state.get('email')
            if not email:
                raise SessionError('Email not found in session')

            # Password should be validated but not stored in state
            if not state.get('password_validated'):
                raise SessionError('Password not validated')

            # Authenticate using credential service
            user = CredentialAuthService.authenticate_user(email, password)

            logger.info(f'User authenticated via chat auth: {user.username}')
            return user

        except (SessionError, AuthenticationFailed, AuthValidationError):
            raise
        except Exception as e:
            logger.error(f'Failed to finalize login for session {session_id}: {e}', exc_info=True)
            raise SessionError(f'Failed to finalize login: {str(e)}') from e

    @staticmethod
    def finalize_session(session_id: str, password: str):
        """Finalize auth session (login or signup) and return user.

        Args:
            session_id: Chat session ID
            password: User's password (never stored in session)

        Returns:
            User instance (newly created or authenticated)

        Raises:
            SessionError: If session data is invalid
            AuthenticationFailed: If login fails
        """
        try:
            state = ChatAuthService.get_session_state(session_id)
            mode = state.get('mode')

            if mode == 'login':
                return ChatAuthService.finalize_login(session_id, password)
            elif mode == 'signup':
                return ChatAuthService.finalize_signup(session_id, password)
            else:
                raise SessionError(f'Invalid session mode: {mode}')

        except (SessionError, AuthenticationFailed, AuthValidationError, UserCreationError):
            raise
        except Exception as e:
            logger.error(f'Failed to finalize session {session_id}: {e}', exc_info=True)
            raise SessionError(f'Failed to finalize session: {str(e)}') from e

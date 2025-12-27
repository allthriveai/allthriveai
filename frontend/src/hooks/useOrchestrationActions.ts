/**
 * Hook for executing orchestration actions from Ava (the site guide).
 *
 * Orchestration actions are commands returned by the orchestration agent's tools.
 * They enable the chat to control the UI: navigate, highlight elements, open trays, etc.
 */

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OrchestrationAction } from './useIntelligentChat';

// Action that requires user confirmation before executing
export interface PendingAction {
  action: OrchestrationAction;
  description: string;
}

interface UseOrchestrationActionsOptions {
  onTrayOpen?: (tray: string, context?: Record<string, unknown>) => void;
}

export function useOrchestrationActions(options: UseOrchestrationActionsOptions = {}) {
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);

  /**
   * Clear any highlighted elements
   */
  const clearHighlight = useCallback(() => {
    if (highlightedElement) {
      const el = document.querySelector(highlightedElement);
      if (el) {
        el.classList.remove(
          'ava-highlight-pulse',
          'ava-highlight-glow',
          'ava-highlight-spotlight',
          'ava-highlight-arrow'
        );
      }
      setHighlightedElement(null);
    }
    // Also remove any spotlight overlay
    const overlay = document.querySelector('.ava-spotlight-overlay');
    if (overlay) {
      overlay.remove();
    }
  }, [highlightedElement]);

  /**
   * Highlight a UI element
   */
  const highlightElement = useCallback((
    target: string,
    style: string = 'pulse',
    duration: number = 3000
  ) => {
    // Clear any existing highlight first
    clearHighlight();

    const el = document.querySelector(target);
    if (!el) {
      console.warn(`[Ava] Element not found: ${target}`);
      return;
    }

    // Add highlight class based on style
    const className = `ava-highlight-${style}`;
    el.classList.add(className);
    setHighlightedElement(target);

    // For spotlight style, add overlay
    if (style === 'spotlight') {
      const overlay = document.createElement('div');
      overlay.className = 'ava-spotlight-overlay';
      document.body.appendChild(overlay);
    }

    // Auto-remove after duration
    setTimeout(() => {
      el.classList.remove(className);
      setHighlightedElement(null);
      // Remove spotlight overlay
      const overlay = document.querySelector('.ava-spotlight-overlay');
      if (overlay) {
        overlay.remove();
      }
    }, duration);
  }, [clearHighlight]);

  /**
   * Show a toast notification via custom event
   * The app's toast system can listen for these events
   */
  const showToast = useCallback((message: string, variant: string = 'info') => {
    // Dispatch custom event that the app's toast system can handle
    window.dispatchEvent(new CustomEvent('ava-toast', {
      detail: { message, variant }
    }));
  }, []);

  /**
   * Get a human-readable description for a trigger action
   */
  const getTriggerDescription = useCallback((action: OrchestrationAction): string => {
    switch (action.trigger_action) {
      case 'start_battle':
        return `Start a battle with ${action.params?.opponent_username || 'an opponent'}?`;
      case 'create_project':
        return 'Open the project creation flow?';
      case 'create_avatar':
        return 'Open the avatar creation wizard?';
      case 'start_quiz':
        return `Start the quiz "${action.params?.quiz_name || 'quiz'}"?`;
      case 'view_profile':
        return `View ${action.params?.username || 'user'}'s profile?`;
      case 'open_project':
        return `Open project "${action.params?.project_slug || action.params?.project_id || 'project'}"?`;
      default:
        return `Execute ${action.trigger_action}?`;
    }
  }, []);

  /**
   * Execute a trigger action (after confirmation if needed)
   */
  const executeTriggerAction = useCallback((action: OrchestrationAction) => {
    switch (action.trigger_action) {
      case 'start_battle':
        // Navigate to battles with opponent pre-selected
        navigate('/play/prompt-battles', { state: { opponent: action.params?.opponent_username } });
        break;
      case 'create_project':
        // Dispatch event to open project creation
        window.dispatchEvent(new CustomEvent('open-project-creation'));
        break;
      case 'create_avatar':
        // Dispatch event to open avatar creation
        window.dispatchEvent(new CustomEvent('open-avatar-creation'));
        break;
      case 'start_quiz':
        // Navigate to quiz
        if (action.params?.quiz_id) {
          navigate(`/quizzes/${action.params.quiz_id}`);
        }
        break;
      case 'view_profile':
        // Navigate to user profile
        if (action.params?.username) {
          navigate(`/${action.params.username}`);
        }
        break;
      case 'open_project':
        // Navigate to project
        if (action.params?.project_slug) {
          // Get current user - project URLs are /{username}/{slug}
          navigate(`/project/${action.params.project_slug}`);
        } else if (action.params?.project_id) {
          navigate(`/project/${action.params.project_id}`);
        }
        break;
      default:
        console.warn(`[Ava] Unknown trigger action: ${action.trigger_action}`);
    }
  }, [navigate]);

  /**
   * Execute an orchestration action
   * Returns true if action was executed, false if it needs confirmation
   */
  const executeAction = useCallback((action: OrchestrationAction): boolean => {
    // If action requires confirmation and not auto_execute, set as pending
    if (action.requires_confirmation && !action.auto_execute) {
      setPendingAction({
        action,
        description: getTriggerDescription(action),
      });
      return false;
    }

    // Execute based on action type
    switch (action.action) {
      case 'navigate':
        if (action.path) {
          navigate(action.path);
          if (action.message) {
            showToast(action.message, 'info');
          }
        }
        break;

      case 'highlight':
        if (action.target) {
          highlightElement(action.target, action.style, action.duration);
        }
        break;

      case 'open_tray':
        if (action.tray) {
          // Dispatch custom event that tray components listen for
          window.dispatchEvent(new CustomEvent('open-tray', {
            detail: { tray: action.tray, context: action.context }
          }));
          // Also call the callback if provided
          options.onTrayOpen?.(action.tray, action.context);
        }
        break;

      case 'toast':
        if (action.message) {
          showToast(action.message, action.variant);
        }
        break;

      case 'trigger':
        if (action.trigger_action) {
          executeTriggerAction(action);
        }
        break;

      default:
        console.warn(`[Ava] Unknown action type: ${action.action}`);
        return false;
    }

    return true;
  }, [navigate, highlightElement, showToast, executeTriggerAction, getTriggerDescription, options]);

  /**
   * Confirm and execute a pending action
   */
  const confirmPendingAction = useCallback(() => {
    if (pendingAction) {
      // Force execute by setting auto_execute
      executeAction({ ...pendingAction.action, auto_execute: true });
      setPendingAction(null);
    }
  }, [pendingAction, executeAction]);

  /**
   * Cancel a pending action
   */
  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    executeAction,
    pendingAction,
    confirmPendingAction,
    cancelPendingAction,
    clearHighlight,
  };
}

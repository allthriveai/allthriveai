import { api } from './api';
import { handleError, logError, validators } from '@/utils/errorHandler';
import type { CompletedQuestInfo } from '@/contexts/QuestCompletionContext';

export interface Comment {
  id: number;
  username: string;
  avatar_url: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote: 'up' | 'down' | null;
  moderation_status: 'pending' | 'approved' | 'rejected' | 'flagged';
  created_at: string;
  updated_at: string;
}

export interface CommentCreateData {
  content: string;
}

export interface CommentVoteData {
  vote_type: 'up' | 'down';
}

export interface CommentCreateResponse extends Comment {
  completedQuests?: CompletedQuestInfo[];
}

/**
 * Get all comments for a project
 */
export async function getProjectComments(projectId: number): Promise<Comment[]> {
  try {
    const response = await api.get(`/projects/${projectId}/comments/`);

    // Handle paginated response from Django REST Framework
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      return response.data.results;
    }

    // Handle direct array response
    if (Array.isArray(response.data)) {
      return response.data;
    }

    // Unexpected format - log and throw
    logError(
      'CommentService.getProjectComments',
      new Error('Unexpected response format'),
      { projectId, responseType: typeof response.data }
    );

    throw new Error('Unexpected response format from server');
  } catch (error) {
    handleError('CommentService.getProjectComments', error, {
      metadata: { projectId },
      showAlert: false, // Let UI component handle display
    });
    throw error; // Re-throw for component to handle
  }
}

/**
 * Create a new comment on a project
 * Returns the created comment and any completed quests triggered by this action
 */
export async function createProjectComment(
  projectId: number,
  data: CommentCreateData
): Promise<CommentCreateResponse> {
  // Pre-validate content
  const validation = validators.commentContent(data.content);
  if (!validation.valid) {
    const error = new Error(validation.error);
    logError('CommentService.createProjectComment', error, {
      projectId,
      contentLength: data.content.length,
      validationError: validation.error,
    });
    throw error;
  }

  try {
    const response = await api.post(`/projects/${projectId}/comments/`, data);
    return response.data;
  } catch (error) {
    handleError('CommentService.createProjectComment', error, {
      metadata: { projectId, contentLength: data.content.length },
      showAlert: false, // Let component handle user feedback
    });
    throw error;
  }
}

/**
 * Vote on a comment (upvote or downvote)
 */
export async function voteOnComment(
  projectId: number,
  commentId: number,
  voteType: 'up' | 'down'
): Promise<{ action: string; comment: Comment }> {
  // Validate vote type
  if (voteType !== 'up' && voteType !== 'down') {
    const error = new Error(`Invalid vote type: ${voteType}`);
    logError('CommentService.voteOnComment', error, {
      projectId,
      commentId,
      voteType,
    });
    throw error;
  }

  try {
    const response = await api.post(
      `/projects/${projectId}/comments/${commentId}/vote/`,
      { vote_type: voteType }
    );
    return response.data;
  } catch (error) {
    handleError('CommentService.voteOnComment', error, {
      metadata: { projectId, commentId, voteType },
      showAlert: false,
    });
    throw error;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(
  projectId: number,
  commentId: number
): Promise<void> {
  try {
    await api.delete(`/projects/${projectId}/comments/${commentId}/`);
  } catch (error) {
    handleError('CommentService.deleteComment', error, {
      metadata: { projectId, commentId },
      showAlert: false,
    });
    throw error;
  }
}

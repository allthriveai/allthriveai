import api from './api';

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

/**
 * Get all comments for a project
 */
export async function getProjectComments(projectId: number): Promise<Comment[]> {
  const response = await api.get(`/projects/${projectId}/comments/`);
  return response.data;
}

/**
 * Create a new comment on a project
 */
export async function createProjectComment(
  projectId: number,
  data: CommentCreateData
): Promise<Comment> {
  const response = await api.post(`/projects/${projectId}/comments/`, data);
  return response.data;
}

/**
 * Vote on a comment (upvote or downvote)
 */
export async function voteOnComment(
  projectId: number,
  commentId: number,
  voteType: 'up' | 'down'
): Promise<{ action: string; comment: Comment }> {
  const response = await api.post(
    `/projects/${projectId}/comments/${commentId}/vote/`,
    { vote_type: voteType }
  );
  return response.data;
}

/**
 * Delete a comment
 */
export async function deleteComment(
  projectId: number,
  commentId: number
): Promise<void> {
  await api.delete(`/projects/${projectId}/comments/${commentId}/`);
}

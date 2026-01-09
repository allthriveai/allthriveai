/**
 * Brand Voice API Service
 *
 * Manages user's brand voice profiles for content creation.
 */

import { api } from './api';
import type { BrandVoice, BrandVoiceMinimal, BrandVoiceFormData } from '@/types/models';

/**
 * Get all brand voices for the current user
 */
export async function getBrandVoices(): Promise<BrandVoice[]> {
  const response = await api.get<BrandVoice[]>('/me/brand-voices/');
  return response.data;
}

/**
 * Get minimal brand voice list for dropdowns
 */
export async function getBrandVoicesMinimal(): Promise<BrandVoiceMinimal[]> {
  const response = await api.get<BrandVoiceMinimal[]>('/me/brand-voices/minimal/');
  return response.data;
}

/**
 * Get a specific brand voice by ID
 */
export async function getBrandVoice(id: number): Promise<BrandVoice> {
  const response = await api.get<BrandVoice>(`/me/brand-voices/${id}/`);
  return response.data;
}

/**
 * Create a new brand voice
 */
export async function createBrandVoice(data: BrandVoiceFormData): Promise<BrandVoice> {
  const response = await api.post<BrandVoice>('/me/brand-voices/', data);
  return response.data;
}

/**
 * Update an existing brand voice
 */
export async function updateBrandVoice(
  id: number,
  data: Partial<BrandVoiceFormData>
): Promise<BrandVoice> {
  const response = await api.patch<BrandVoice>(`/me/brand-voices/${id}/`, data);
  return response.data;
}

/**
 * Delete a brand voice
 */
export async function deleteBrandVoice(id: number): Promise<void> {
  await api.delete(`/me/brand-voices/${id}/`);
}

/**
 * Set a brand voice as the default
 */
export async function setDefaultBrandVoice(id: number): Promise<BrandVoice> {
  const response = await api.post<BrandVoice>(`/me/brand-voices/${id}/set-default/`);
  return response.data;
}

/**
 * Get the user's default brand voice (if any)
 */
export async function getDefaultBrandVoice(): Promise<BrandVoice | null> {
  const voices = await getBrandVoices();
  return voices.find((v) => v.isDefault) || null;
}

/**
 * Tone options for brand voice selection
 */
export const BRAND_VOICE_TONES = [
  { value: 'casual', label: 'Casual & Friendly', description: 'Relaxed, approachable tone' },
  { value: 'professional', label: 'Professional', description: 'Polished, business-appropriate' },
  { value: 'provocative', label: 'Bold & Provocative', description: 'Challenges assumptions, attention-grabbing' },
  { value: 'educational', label: 'Educational', description: 'Clear, informative, teaching-focused' },
  { value: 'inspirational', label: 'Inspirational', description: 'Motivating, uplifting messaging' },
  { value: 'humorous', label: 'Humorous', description: 'Light-hearted, entertaining' },
] as const;

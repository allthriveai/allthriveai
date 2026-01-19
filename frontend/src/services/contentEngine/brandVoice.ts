/**
 * Content Engine Brand Voice API Service
 * US-009: Brand Voice Tab
 *
 * Re-exports existing brand voice service for use within Content Engine
 */

export {
  getBrandVoices,
  getBrandVoicesMinimal,
  createBrandVoice,
  updateBrandVoice,
  deleteBrandVoice,
  setDefaultBrandVoice,
  BRAND_VOICE_TONES,
} from '@/services/brandVoice';

export type { BrandVoice, BrandVoiceMinimal, BrandVoiceFormData, BrandVoiceTone } from '@/types/models';

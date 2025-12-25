/**
 * AvatarCreationMessage - Inline avatar creation in chat
 *
 * Renders the avatar creation flow inline in the chat (not as a modal).
 * Mirrors the onboarding avatar creation experience.
 */

import { motion } from 'framer-motion';
import { SparklesIcon, ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { AvatarTemplateSelector, defaultAvatarTemplates } from '../onboarding/AvatarTemplateSelector';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import type { UseStandaloneAvatarCreationReturn } from '@/hooks/useStandaloneAvatarCreation';

// Ember avatar component - positioned at bottom
function EmberAvatar() {
  return (
    <div className="relative flex-shrink-0 self-end">
      <img
        src="/ember-avatar.png"
        alt="Ember"
        className="w-12 h-12 rounded-full border-2 border-cyan-500/50"
      />
    </div>
  );
}

interface AvatarPreviewProps {
  imageUrl: string;
  onAccept: () => void;
  onRefine: () => void;
  onSkip: () => void;
  isAccepting: boolean;
}

function AvatarPreview({
  imageUrl,
  onAccept,
  onRefine,
  onSkip,
  isAccepting,
}: AvatarPreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
    >
      <div className="flex items-end gap-4">
        <EmberAvatar />

        <div className="flex-1 max-w-2xl space-y-4">
          {/* Header message */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-subtle px-5 py-4 rounded bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20"
          >
            <p className="text-orange-100 text-lg leading-relaxed">
              Here's your avatar! What do you think? You can accept it, or try refining your prompt
              for a different result.
            </p>
          </motion.div>

          {/* Avatar preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-[-8px] bg-gradient-to-r from-orange-500/30 via-amber-500/30 to-orange-500/30 rounded-full blur-xl" />

              {/* Avatar image */}
              <div className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-orange-500/30 shadow-2xl">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Your generated avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <ArrowPathIcon className="w-8 h-8 text-slate-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Success badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-lg"
              >
                <SparklesIcon className="w-6 h-6 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Prompt engineering tip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="px-5 py-4 rounded-xl bg-orange-500/10 border border-orange-500/20"
          >
            <p className="text-orange-200 text-base">
              <span className="font-semibold text-orange-300">Pro tip:</span> If your avatar isn't quite right, try
              being more specific about what you want to change. Good prompts lead to better results!
            </p>
          </motion.div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button onClick={onRefine} className="flex-1 btn-ghost px-6 py-3 text-base">
              <ArrowPathIcon className="w-5 h-5 mr-2 inline" />
              Try Again
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAccept}
              disabled={isAccepting}
              className="flex-1 btn-primary px-6 py-3 text-base shadow-neon flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAccepting ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-5 h-5" />
                  Use This Avatar
                </>
              )}
            </motion.button>
          </div>

          {/* Skip option */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center"
          >
            <button
              onClick={onSkip}
              className="text-slate-500 text-base hover:text-slate-400 transition-colors"
            >
              Skip for now
            </button>
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}

export interface AvatarCreationMessageProps {
  avatarCreation: UseStandaloneAvatarCreationReturn;
}

export function AvatarCreationMessage({ avatarCreation }: AvatarCreationMessageProps) {
  if (!avatarCreation.isActive) return null;

  const {
    currentStep,
    selectedTemplate,
    avatarPrompt,
    referenceImageUrl,
    generatedAvatarUrl,
    isConnecting,
    isGenerating,
    isSaving,
    error,
    handleSelectTemplate,
    handlePromptChange,
    handleReferenceImageChange,
    handleGenerate,
    handleAccept,
    handleRefine,
    handleSkip,
    close,
  } = avatarCreation;

  // Preview step
  if (currentStep === 'avatar-preview' && generatedAvatarUrl) {
    return (
      <ChatErrorBoundary resetKey="avatar-creation-preview">
        <AvatarPreview
          imageUrl={generatedAvatarUrl}
          onAccept={handleAccept}
          onRefine={handleRefine}
          onSkip={handleSkip}
          isAccepting={isSaving}
        />
      </ChatErrorBoundary>
    );
  }

  // Create step (template selector)
  return (
    <ChatErrorBoundary resetKey="avatar-creation-create">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-4"
      >
        <div className="flex items-end gap-4">
          <EmberAvatar />

          <div className="flex-1 max-w-2xl">
            {/* Close button */}
            <div className="flex justify-end mb-2">
              <button
                onClick={close}
                className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <AvatarTemplateSelector
              templates={defaultAvatarTemplates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleSelectTemplate}
              prompt={avatarPrompt}
              onPromptChange={handlePromptChange}
              onGenerate={handleGenerate}
              onSkip={handleSkip}
              isGenerating={isGenerating}
              isConnecting={isConnecting}
              error={error}
              referenceImageUrl={referenceImageUrl ?? undefined}
              onReferenceImageChange={handleReferenceImageChange}
            />
          </div>
        </div>
      </motion.div>
    </ChatErrorBoundary>
  );
}

export default AvatarCreationMessage;

/**
 * AvatarTemplateSelector - Avatar creation UI for onboarding
 *
 * Shows template buttons and prompt input for avatar generation.
 * Supports photo upload for "Make Me" style avatar generation.
 * Uses typewriter effect for Ember's messages with orange theme.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHatWizard,
  faRobot,
  faUserAstronaut,
  faRocket,
  faCamera,
} from '@fortawesome/free-solid-svg-icons';
import { SparklesIcon, ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { uploadImage } from '@/services/upload';
import type { AvatarTemplate } from '@/hooks/useIntelligentChat';

// Map icon names to actual icons
const iconMap: Record<string, typeof faRobot> = {
  faHatWizard,
  faRobot,
  faUserAstronaut,
  faRocket,
};

// Default avatar templates
export const defaultAvatarTemplates: AvatarTemplate[] = [
  {
    id: 'wizard',
    label: 'Wizard',
    icon: 'faHatWizard',
    color: 'from-violet-500 to-purple-600',
    starterPrompt: 'A wise wizard with a mystical staff and glowing runes on their robes',
  },
  {
    id: 'robot',
    label: 'Robot',
    icon: 'faRobot',
    color: 'from-cyan-500 to-blue-600',
    starterPrompt: 'A friendly robot with glowing blue eyes and a sleek chrome finish',
  },
  {
    id: 'astronaut',
    label: 'Astronaut',
    icon: 'faUserAstronaut',
    color: 'from-indigo-500 to-violet-600',
    starterPrompt: 'An astronaut in a colorful spacesuit floating among the stars',
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: 'faRocket',
    color: 'from-amber-500 to-orange-600',
    starterPrompt: 'An adventurous explorer with a safari hat and binoculars',
  },
];

// Typewriter hook for video game dialogue effect
function useTypewriter(text: string, speed: number = 30, startDelay: number = 0, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    setDisplayedText('');
    setIsComplete(false);

    let index = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        if (index < text.length) {
          index++;
          setDisplayedText(text.slice(0, index));
        } else {
          setIsComplete(true);
          if (intervalId) clearInterval(intervalId);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, speed, startDelay, enabled]);

  const skip = useCallback(() => {
    setDisplayedText(text);
    setIsComplete(true);
  }, [text]);

  return { displayedText, isComplete, skip };
}

// Ember avatar component - positioned at bottom
function EmberAvatar({ isSpeaking = false }: { isSpeaking?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', delay: 0.1 }}
      className="relative flex-shrink-0 self-end"
    >
      <motion.div
        animate={isSpeaking ? {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-orange-500/20 rounded-full blur-xl pointer-events-none"
      />
      <motion.div
        animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <img
          src="/ember-avatar.png"
          alt="Ember"
          className="w-12 h-12 rounded-full border-2 border-cyan-500/50"
        />
      </motion.div>
    </motion.div>
  );
}

// Dialogue bubble component
function DialogueBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="glass-subtle px-5 py-4 rounded bg-gradient-to-br from-orange-500/10 to-amber-500/5 dark:from-orange-500/10 dark:to-amber-500/5 border border-orange-500/30 dark:border-orange-500/20"
    >
      {children}
    </motion.div>
  );
}

interface AvatarTemplateSelectorProps {
  templates?: AvatarTemplate[];
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onSkip: () => void;
  isGenerating: boolean;
  isConnecting: boolean;
  error: string | null;
  referenceImageUrl?: string;
  onReferenceImageChange?: (url: string | null) => void;
}

export function AvatarTemplateSelector({
  templates = defaultAvatarTemplates,
  selectedTemplate,
  onSelectTemplate,
  prompt,
  onPromptChange,
  onGenerate,
  onSkip,
  isGenerating,
  isConnecting,
  error,
  referenceImageUrl,
  onReferenceImageChange,
}: AvatarTemplateSelectorProps) {

  const [dialogueStep, setDialogueStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(referenceImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialogue lines with typewriter effects
  const line1 = useTypewriter("Let's create your avatar!", 25, 200, true);
  const line2 = useTypewriter(
    'Describe what you want it to look like, or pick a template to get started. The more detail you give, the better your result.',
    20,
    100,
    dialogueStep >= 1
  );
  const line3 = useTypewriter(
    'This is your first taste of prompt engineering — telling AI exactly what you want.',
    20,
    100,
    dialogueStep >= 2
  );

  const isSpeaking =
    !line1.isComplete ||
    (!line2.isComplete && dialogueStep >= 1) ||
    (!line3.isComplete && dialogueStep >= 2);

  // Progress through dialogue steps
  useEffect(() => {
    if (line1.isComplete && dialogueStep === 0) {
      const timer = setTimeout(() => setDialogueStep(1), 300);
      return () => clearTimeout(timer);
    }
  }, [line1.isComplete, dialogueStep]);

  useEffect(() => {
    if (line2.isComplete && dialogueStep === 1) {
      const timer = setTimeout(() => setDialogueStep(2), 300);
      return () => clearTimeout(timer);
    }
  }, [line2.isComplete, dialogueStep]);

  useEffect(() => {
    if (line3.isComplete && dialogueStep === 2) {
      const timer = setTimeout(() => setDialogueStep(3), 300);
      return () => clearTimeout(timer);
    }
  }, [line3.isComplete, dialogueStep]);

  const handleSkipDialogue = () => {
    line1.skip();
    line2.skip();
    line3.skip();
    setDialogueStep(3);
  };

  // File upload handlers
  const handleFileUpload = useCallback(async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please upload a JPG, PNG, or WebP image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be smaller than 10MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await uploadImage(file, 'avatar-references', true);
      setPreviewUrl(response.url);
      onReferenceImageChange?.(response.url);
      // Clear template selection when photo is uploaded
      onSelectTemplate('make_me');
      onPromptChange('Create an avatar that looks like me in this photo');
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [onReferenceImageChange, onSelectTemplate, onPromptChange]);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onReferenceImageChange?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset to scratch mode
    if (selectedTemplate === 'make_me') {
      onSelectTemplate('');
      onPromptChange('');
    }
  };

  const showControls = dialogueStep >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4"
      onClick={!showControls ? handleSkipDialogue : undefined}
    >
      {/* Layout with Ember avatar alongside content */}
      <div className="flex items-end gap-4">
        <EmberAvatar isSpeaking={isSpeaking} />

        <div className="flex-1 max-w-2xl space-y-3">
          {/* Line 1: Let's create your avatar! */}
          <DialogueBubble>
            <p className="text-orange-800 dark:text-orange-100 text-lg leading-relaxed">
              {line1.displayedText}
              {!line1.isComplete && <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>}
            </p>
          </DialogueBubble>

          {/* Line 2: Instructions */}
          <AnimatePresence>
            {dialogueStep >= 1 && (
              <DialogueBubble>
                <p className="text-orange-700 dark:text-orange-100/90 text-lg leading-relaxed">
                  {line2.displayedText}
                  {!line2.isComplete && dialogueStep === 1 && (
                    <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>
                  )}
                </p>
              </DialogueBubble>
            )}
          </AnimatePresence>

          {/* Line 3: Prompt engineering intro */}
          <AnimatePresence>
            {dialogueStep >= 2 && (
              <DialogueBubble>
                <p className="text-orange-600 dark:text-orange-100/80 text-lg leading-relaxed">
                  {line3.displayedText.split('prompt engineering').map((part, i) =>
                    i === 0 ? (
                      part
                    ) : (
                      <span key={i}>
                        <span className="text-orange-700 dark:text-orange-300 font-semibold">prompt engineering</span>
                        {part}
                      </span>
                    )
                  )}
                  {!line3.isComplete && dialogueStep === 2 && (
                    <span className="animate-pulse text-orange-500 dark:text-orange-400 ml-0.5">|</span>
                  )}
                </p>
              </DialogueBubble>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls - appear after dialogue completes */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 ml-16 space-y-4"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Template shortcuts */}
            <div>
              <p className="text-orange-700/80 dark:text-orange-200/60 text-base mb-3">Quick start with a template:</p>
              <div className="flex gap-3 flex-wrap">
                {templates.map((template) => {
                  const icon = iconMap[template.icon] || faRobot;
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (selectedTemplate === template.id) {
                          onSelectTemplate('');
                          onPromptChange('');
                        } else {
                          onSelectTemplate(template.id);
                          // If photo is uploaded, combine with template style
                          if (previewUrl) {
                            onPromptChange(`Make me look like ${template.starterPrompt.toLowerCase()}`);
                          } else {
                            onPromptChange(template.starterPrompt);
                          }
                          // Note: We intentionally DO NOT clear the photo when selecting a template
                          // This allows users to combine their photo with a template style
                        }
                      }}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-full text-base font-medium transition-all
                        ${
                          selectedTemplate === template.id
                            ? `bg-gradient-to-r ${template.color} text-white shadow-lg`
                            : 'bg-slate-200 dark:bg-slate-800/50 text-slate-700 dark:text-orange-200/80 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50 border border-slate-300 dark:border-orange-500/20'
                        }
                      `}
                    >
                      <FontAwesomeIcon icon={icon} className="text-sm" />
                      {template.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo upload section */}
            <div>
              <p className="text-orange-700/80 dark:text-orange-200/60 text-base mb-3">Or upload your photo:</p>
              {previewUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Your uploaded photo"
                      className="w-24 h-24 rounded object-cover border-2 border-orange-500/30"
                    />
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                      aria-label="Remove photo"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-orange-800 dark:text-orange-100 text-base">Photo uploaded!</p>
                    <p className="text-orange-600/80 dark:text-orange-200/60 text-sm">We'll create an avatar based on your photo</p>
                  </div>
                </div>
              ) : (
                <div
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative cursor-pointer rounded border-2 border-dashed p-6 transition-all
                    flex flex-col items-center justify-center gap-3
                    ${isDragging
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-orange-400 dark:border-orange-500/30 hover:border-orange-500 dark:hover:border-orange-500/50 hover:bg-orange-500/5'
                    }
                    ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                  `}
                >
                  {isUploading ? (
                    <>
                      <ArrowPathIcon className="w-8 h-8 text-orange-500 dark:text-orange-400 animate-spin" />
                      <p className="text-orange-700 dark:text-orange-200/80 text-base">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faCamera} className="text-2xl text-orange-500 dark:text-orange-400" />
                      <div className="text-center">
                        <p className="text-orange-800 dark:text-orange-100 text-base">
                          {isDragging ? 'Drop your photo here' : 'Drag & drop your photo'}
                        </p>
                        <p className="text-orange-600/80 dark:text-orange-200/60 text-sm mt-1">or click to browse</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              {uploadError && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-2">{uploadError}</p>
              )}
            </div>

            {/* Prompt input */}
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder={
                selectedTemplate
                  ? `Edit to customize your ${selectedTemplate}...`
                  : 'Describe your avatar (e.g., "a friendly robot with glowing green eyes")'
              }
              className="w-full h-28 px-4 py-3 rounded bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-orange-500/20 focus:border-orange-500 dark:focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 text-slate-800 dark:text-orange-100 text-lg placeholder:text-slate-500 dark:placeholder:text-orange-200/40 resize-none transition-all"
            />

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 rounded bg-red-500/10 border border-red-500/20"
              >
                <p className="text-red-400 text-base">{error}</p>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              <button onClick={onSkip} className="flex-1 btn-ghost px-6 py-3 text-base">
                Skip for now
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGenerate}
                disabled={isGenerating || isConnecting || !prompt.trim()}
                className="flex-1 btn-primary px-6 py-3 text-base shadow-neon disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating || isConnecting ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    {isConnecting ? 'Connecting...' : 'Creating your avatar...'}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    Generate Avatar
                  </>
                )}
              </motion.button>
            </div>
            {/* Time estimate shown during generation */}
            {isGenerating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-slate-500 dark:text-slate-400 text-sm mt-3"
              >
                This usually takes 15-20 seconds
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip hint */}
      {!showControls && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-slate-600 text-sm mt-4 ml-16"
        >
          Tap anywhere to skip
        </motion.p>
      )}
    </motion.div>
  );
}

export default AvatarTemplateSelector;

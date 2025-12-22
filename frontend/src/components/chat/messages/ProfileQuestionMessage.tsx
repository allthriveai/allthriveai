/**
 * ProfileQuestionMessage - Interactive profile-building questions
 *
 * Renders fun, clickable pills/cards for profile-building questions.
 * Three visual formats supported:
 * - single: Horizontal pills, pick one
 * - multi: Pills with submit button, pick multiple
 * - this_or_that: Two big cards with VS divider
 *
 * Styled with Neon Glass aesthetic to match the platform.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

export interface ProfileQuestionOption {
  id: string;
  label: string;
  emoji?: string;
  description?: string;
}

export interface ProfileQuestionConfig {
  questionId: string;
  questionType: 'single' | 'multi' | 'this_or_that';
  prompt: string;
  options: ProfileQuestionOption[];
  targetField: string;
  allowMultiple?: boolean;
  followUpPrompt?: string;
}

export interface ProfileQuestionMessageProps {
  config: ProfileQuestionConfig;
  onAnswer: (questionId: string, selectedOptions: string[]) => void;
  disabled?: boolean;
}

export function ProfileQuestionMessage({
  config,
  onAnswer,
  disabled = false,
}: ProfileQuestionMessageProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hasAnswered, setHasAnswered] = useState(false);

  const handleSelect = (optionId: string) => {
    if (hasAnswered || disabled) return;

    if (config.questionType === 'multi' || config.allowMultiple) {
      // Multi-select: toggle selection
      setSelected((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      // Single-select: auto-submit on click
      setSelected([optionId]);
      setHasAnswered(true);
      onAnswer(config.questionId, [optionId]);
    }
  };

  const handleSubmitMulti = () => {
    if (selected.length === 0 || hasAnswered || disabled) return;
    setHasAnswered(true);
    onAnswer(config.questionId, selected);
  };

  // Render different layouts based on question type
  if (config.questionType === 'this_or_that') {
    return (
      <ThisOrThatQuestion
        config={config}
        selected={selected}
        hasAnswered={hasAnswered}
        disabled={disabled}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <motion.div
      className="w-full max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Question prompt */}
      <div className="mb-4">
        <div
          className="inline-block px-5 py-3 bg-gradient-to-br from-orange-500/10 to-amber-500/5
            border border-orange-500/20 backdrop-blur-sm"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <p className="text-base text-orange-100">{config.prompt}</p>
        </div>
      </div>

      {/* Option pills */}
      <div className="flex flex-wrap gap-2">
        {config.options.map((option, index) => {
          const isSelected = selected.includes(option.id);
          const isFaded = hasAnswered && !isSelected;

          return (
            <motion.button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={hasAnswered || disabled}
              className={`
                group relative px-4 py-2.5 text-left
                bg-gradient-to-br from-slate-800/60 to-slate-900/60
                border backdrop-blur-sm
                transition-all duration-200
                ${isSelected
                  ? 'border-orange-500/50 ring-2 ring-orange-500/30'
                  : 'border-slate-600/30 hover:border-orange-400/40'
                }
                ${isFaded ? 'opacity-40' : 'opacity-100'}
                ${hasAnswered || disabled ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'}
              `}
              style={{ borderRadius: 'var(--radius)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: isFaded ? 0.4 : 1, scale: 1 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
              whileHover={!hasAnswered && !disabled ? { scale: 1.02 } : {}}
              whileTap={!hasAnswered && !disabled ? { scale: 0.98 } : {}}
            >
              <div className="flex items-center gap-2">
                {/* Selection indicator for multi-select */}
                {config.questionType === 'multi' && (
                  <div
                    className={`
                      w-4 h-4 rounded-sm border flex items-center justify-center
                      ${isSelected
                        ? 'bg-orange-500 border-orange-500'
                        : 'border-slate-500 bg-transparent'
                      }
                    `}
                  >
                    {isSelected && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        className="w-2.5 h-2.5 text-white"
                      />
                    )}
                  </div>
                )}

                {/* Emoji */}
                {option.emoji && (
                  <span className="text-lg">{option.emoji}</span>
                )}

                {/* Label */}
                <span className="text-sm font-medium text-slate-100">
                  {option.label}
                </span>

                {/* Selected checkmark for single select */}
                {config.questionType !== 'multi' && isSelected && (
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="w-3 h-3 text-orange-400 ml-1"
                  />
                )}
              </div>

              {/* Description tooltip on hover */}
              {option.description && !hasAnswered && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5
                    bg-slate-900/95 border border-slate-700/50 text-xs text-slate-300
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                    whitespace-nowrap z-10"
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  {option.description}
                </div>
              )}

              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100
                  transition-opacity duration-300 pointer-events-none"
                style={{ borderRadius: 'var(--radius)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-amber-500/5" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Submit button for multi-select */}
      {config.questionType === 'multi' && !hasAnswered && (
        <motion.div
          className="mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={handleSubmitMulti}
            disabled={selected.length === 0 || disabled}
            className={`
              px-4 py-2 text-sm font-medium
              bg-gradient-to-r from-orange-500 to-amber-500
              text-white shadow-lg
              transition-all duration-200
              ${selected.length === 0 || disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:from-orange-400 hover:to-amber-400 hover:shadow-neon cursor-pointer'
              }
            `}
            style={{ borderRadius: 'var(--radius)' }}
          >
            Done ({selected.length} selected)
          </button>
        </motion.div>
      )}

      {/* Answered confirmation */}
      {hasAnswered && (
        <motion.div
          className="mt-3 flex items-center gap-2 text-sm text-orange-200/60"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3" />
          <span>Got it! Thanks for sharing</span>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * This-or-That variant with two big cards
 */
function ThisOrThatQuestion({
  config,
  selected,
  hasAnswered,
  disabled,
  onSelect,
}: {
  config: ProfileQuestionConfig;
  selected: string[];
  hasAnswered: boolean;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}) {
  // Should have exactly 2 options for this format
  const [optionA, optionB] = config.options;

  if (!optionA || !optionB) {
    return null;
  }

  return (
    <motion.div
      className="w-full max-w-lg"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Question prompt */}
      <div className="mb-4">
        <div
          className="inline-block px-5 py-3 bg-gradient-to-br from-orange-500/10 to-amber-500/5
            border border-orange-500/20 backdrop-blur-sm"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <p className="text-base text-orange-100">{config.prompt}</p>
        </div>
      </div>

      {/* Two cards with VS */}
      <div className="flex items-stretch gap-3">
        {/* Option A */}
        <ThisOrThatCard
          option={optionA}
          isSelected={selected.includes(optionA.id)}
          isFaded={hasAnswered && !selected.includes(optionA.id)}
          disabled={hasAnswered || disabled}
          onClick={() => onSelect(optionA.id)}
          delay={0}
        />

        {/* VS divider */}
        <div className="flex items-center">
          <span className="text-sm font-bold text-slate-500">VS</span>
        </div>

        {/* Option B */}
        <ThisOrThatCard
          option={optionB}
          isSelected={selected.includes(optionB.id)}
          isFaded={hasAnswered && !selected.includes(optionB.id)}
          disabled={hasAnswered || disabled}
          onClick={() => onSelect(optionB.id)}
          delay={0.1}
        />
      </div>

      {/* Answered confirmation */}
      {hasAnswered && (
        <motion.div
          className="mt-3 flex items-center gap-2 text-sm text-orange-200/60"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} className="w-3 h-3" />
          <span>That tells me a lot about how you like to learn!</span>
        </motion.div>
      )}
    </motion.div>
  );
}

function ThisOrThatCard({
  option,
  isSelected,
  isFaded,
  disabled,
  onClick,
  delay,
}: {
  option: ProfileQuestionOption;
  isSelected: boolean;
  isFaded: boolean;
  disabled: boolean;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 p-5 text-center
        bg-gradient-to-br from-slate-800/60 to-slate-900/60
        border backdrop-blur-sm
        transition-all duration-200
        ${isSelected
          ? 'border-orange-500/50 ring-2 ring-orange-500/30'
          : 'border-slate-600/30 hover:border-orange-400/40'
        }
        ${isFaded ? 'opacity-40' : 'opacity-100'}
        ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02]'}
      `}
      style={{ borderRadius: 'var(--radius)' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isFaded ? 0.4 : 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
      whileHover={!disabled ? { scale: 1.03 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {/* Emoji */}
      {option.emoji && (
        <div className="text-3xl mb-2">{option.emoji}</div>
      )}

      {/* Label */}
      <div className="text-lg font-semibold text-slate-100 mb-1">
        {option.label}
      </div>

      {/* Description */}
      {option.description && (
        <div className="text-xs text-slate-400">
          {option.description}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          className="absolute top-2 right-2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-white" />
          </div>
        </motion.div>
      )}
    </motion.button>
  );
}

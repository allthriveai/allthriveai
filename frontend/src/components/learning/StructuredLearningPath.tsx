/**
 * StructuredLearningPath - Main learning path visualization
 *
 * Displays the user's personalized learning path with:
 * - Current focus card
 * - Progress header
 * - Topic sections with concept nodes
 */

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faLock,
  faPlayCircle,
  faCircle,
  faChevronDown,
  faChevronRight,
  faClock,
  faGraduationCap,
  faRotate,
  faComments,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import type { StructuredPath, TopicSection, ConceptNode, ConceptStatus } from '@/types/models';

// Concept click context passed to parent
export interface ConceptClickContext {
  conceptSlug: string;
  conceptName: string;
  topicSlug: string;
  topicName: string;
}

// Status icon mapping
const statusIcons: Record<ConceptStatus, typeof faCheckCircle> = {
  completed: faCheckCircle,
  in_progress: faPlayCircle,
  available: faCircle,
  locked: faLock,
};

const statusColors: Record<ConceptStatus, string> = {
  completed: 'text-emerald-500',
  in_progress: 'text-cyan-400',
  available: 'text-gray-400',
  locked: 'text-gray-600',
};

const statusBgColors: Record<ConceptStatus, string> = {
  completed: 'bg-emerald-500/10 border-emerald-500/30',
  in_progress: 'bg-cyan-500/10 border-cyan-500/30 ring-2 ring-cyan-500/20',
  available: 'bg-gray-500/5 border-gray-500/20 hover:border-gray-400/40',
  locked: 'bg-gray-800/50 border-gray-700/30',
};

/**
 * Current Focus Card - Prominent display of what to work on next
 */
interface CurrentFocusCardProps {
  concept: ConceptNode | null;
  topicName: string;
  topicSlug: string;
  onConceptClick?: (context: ConceptClickContext) => void;
}

function CurrentFocusCard({ concept, topicName, topicSlug, onConceptClick }: CurrentFocusCardProps) {
  if (!concept) {
    return (
      <div className="glass-strong p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="flex items-center gap-3 mb-2">
          <FontAwesomeIcon icon={faGraduationCap} className="text-emerald-500 text-xl" />
          <h2 className="text-lg font-semibold text-white">All caught up!</h2>
        </div>
        <p className="text-gray-400">
          You've completed all available concepts. Check back soon for new content!
        </p>
      </div>
    );
  }

  const handleClick = () => {
    if (onConceptClick) {
      onConceptClick({
        conceptSlug: concept.slug,
        conceptName: concept.name,
        topicSlug,
        topicName,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-cyan-400 text-sm font-medium uppercase tracking-wide mb-1">
            Current Focus
          </p>
          <h2 className="text-xl font-bold text-white mb-2">{concept.name}</h2>
          <p className="text-gray-400 text-sm mb-3">{concept.description}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="capitalize">{topicName}</span>
            {concept.estimatedMinutes > 0 && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faClock} className="text-xs" />
                {concept.estimatedMinutes} min
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleClick}
          className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faComments} />
          Learn with Ava
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Progress Header - Overall completion percentage
 */
interface ProgressHeaderProps {
  overallProgress: number;
  completedConcepts: number;
  totalConcepts: number;
}

function ProgressHeader({ overallProgress, completedConcepts, totalConcepts }: ProgressHeaderProps) {
  const percentage = Math.round(overallProgress * 100);

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your Learning Path</h1>
        <p className="text-gray-400">
          {completedConcepts} of {totalConcepts} concepts completed
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
          />
        </div>
        <span className="text-lg font-bold text-white">{percentage}%</span>
      </div>
    </div>
  );
}

/**
 * Concept Node - Individual concept in the path
 */
interface ConceptNodeItemProps {
  concept: ConceptNode;
  isLast: boolean;
  topicSlug: string;
  topicName: string;
  onConceptClick?: (context: ConceptClickContext) => void;
}

function ConceptNodeItem({ concept, isLast, topicSlug, topicName, onConceptClick }: ConceptNodeItemProps) {
  const isClickable = concept.status === 'available' || concept.status === 'in_progress';

  const handleClick = () => {
    if (isClickable && onConceptClick) {
      onConceptClick({
        conceptSlug: concept.slug,
        conceptName: concept.name,
        topicSlug,
        topicName,
      });
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative flex items-center gap-4 p-4 rounded-lg border transition-all
        ${statusBgColors[concept.status]}
        ${isClickable ? 'cursor-pointer hover:border-cyan-500/40' : 'cursor-default'}
      `}
    >
      {/* Status indicator */}
      <div className={`flex-shrink-0 ${statusColors[concept.status]}`}>
        <FontAwesomeIcon icon={statusIcons[concept.status]} className="text-xl" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium ${concept.status === 'locked' ? 'text-gray-500' : 'text-white'}`}>
          {concept.name}
        </h4>
        {concept.status !== 'locked' && (
          <p className="text-sm text-gray-500 truncate">{concept.description}</p>
        )}
      </div>

      {/* Right side info */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {concept.estimatedMinutes > 0 && concept.status !== 'locked' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <FontAwesomeIcon icon={faClock} />
            {concept.estimatedMinutes}m
          </span>
        )}
        {concept.hasQuiz && concept.status !== 'locked' && (
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
            Quiz
          </span>
        )}
        {isClickable && (
          <FontAwesomeIcon icon={faComments} className="text-cyan-400" />
        )}
      </div>

      {/* Connection line to next node */}
      {!isLast && (
        <div className="absolute left-7 top-full w-0.5 h-3 bg-gray-700" />
      )}
    </div>
  );
}

/**
 * Topic Section - Expandable group of concepts
 */
interface TopicSectionCardProps {
  topic: TopicSection;
  defaultExpanded?: boolean;
  onConceptClick?: (context: ConceptClickContext) => void;
}

function TopicSectionCard({ topic, defaultExpanded = false, onConceptClick }: TopicSectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const progressPercentage = Math.round(topic.progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-subtle rounded-xl overflow-hidden"
    >
      {/* Topic header - clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          className="text-gray-400"
        />
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-white">{topic.name}</h3>
          <p className="text-sm text-gray-500">
            {topic.completedCount} of {topic.conceptCount} concepts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-400 w-10 text-right">
            {progressPercentage}%
          </span>
        </div>
      </button>

      {/* Concept list */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 space-y-3"
        >
          {topic.concepts.map((concept, index) => (
            <ConceptNodeItem
              key={concept.id}
              concept={concept}
              isLast={index === topic.concepts.length - 1}
              topicSlug={topic.slug}
              topicName={topic.name}
              onConceptClick={onConceptClick}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}


/**
 * Main StructuredLearningPath component
 */
export interface StructuredLearningPathProps {
  pathData: StructuredPath;
  onResetPath?: () => void;
  isResetting?: boolean;
  onConceptClick?: (context: ConceptClickContext) => void;
}

export function StructuredLearningPath({ pathData, onResetPath, isResetting, onConceptClick }: StructuredLearningPathProps) {
  // Find the topic that contains the current focus
  const currentTopicSlug = pathData.currentFocus?.topicSlug || '';
  const currentTopicName = pathData.currentFocus?.topicName || '';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Progress header */}
      <ProgressHeader
        overallProgress={pathData.overallProgress}
        completedConcepts={pathData.completedConcepts}
        totalConcepts={pathData.totalConcepts}
      />

      {/* Current focus card */}
      <div className="mb-8">
        <CurrentFocusCard
          concept={pathData.currentFocus?.concept || null}
          topicName={currentTopicName}
          topicSlug={currentTopicSlug}
          onConceptClick={onConceptClick}
        />
      </div>

      {/* Topic sections */}
      <div className="space-y-4">
        {pathData.topics.map((topic) => (
          <TopicSectionCard
            key={topic.slug}
            topic={topic}
            defaultExpanded={topic.slug === currentTopicSlug}
            onConceptClick={onConceptClick}
          />
        ))}
      </div>

      {/* Change Learning Goal button */}
      {onResetPath && (
        <div className="mt-8 pt-6 border-t border-gray-700/50">
          <button
            onClick={onResetPath}
            disabled={isResetting}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faRotate} className={isResetting ? 'animate-spin' : ''} />
            {isResetting ? 'Resetting...' : 'Change Learning Goal'}
          </button>
        </div>
      )}
    </div>
  );
}

export default StructuredLearningPath;

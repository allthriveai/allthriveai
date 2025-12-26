/**
 * Feedback Panel Component
 * Displays code validation feedback with errors, warnings, and suggestions
 */

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleXmark,
  faTriangleExclamation,
  faLightbulb,
  faCircleCheck,
  faChevronDown,
  faChevronUp,
  faRobot,
  faThumbsUp,
} from '@fortawesome/free-solid-svg-icons';
import type { FeedbackPanelProps, CodeFeedbackIssue } from './types';

function IssueCard({ issue, expanded, onToggle }: {
  issue: CodeFeedbackIssue;
  expanded: boolean;
  onToggle: () => void;
}) {
  const getIcon = () => {
    switch (issue.type) {
      case 'error':
        return faCircleXmark;
      case 'warning':
        return faTriangleExclamation;
      case 'suggestion':
        return faLightbulb;
    }
  };

  const getColors = () => {
    switch (issue.type) {
      case 'error':
        return {
          bg: 'bg-red-500/10 border-red-500/30',
          icon: 'text-red-400',
          badge: 'bg-red-500/20 text-red-300',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30',
          icon: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300',
        };
      case 'suggestion':
        return {
          bg: 'bg-blue-500/10 border-blue-500/30',
          icon: 'text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300',
        };
    }
  };

  const colors = getColors();
  const hasDetails = issue.explanation || issue.hint;

  return (
    <div className={`rounded-lg border ${colors.bg} overflow-hidden`}>
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/5 transition-colors"
        disabled={!hasDetails}
      >
        <FontAwesomeIcon icon={getIcon()} className={`mt-0.5 ${colors.icon}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {issue.line && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${colors.badge}`}>
                Line {issue.line}
              </span>
            )}
            <span className="text-sm text-slate-200">{issue.message}</span>
          </div>
        </div>

        {hasDetails && (
          <FontAwesomeIcon
            icon={expanded ? faChevronUp : faChevronDown}
            className="text-slate-500 text-xs mt-1"
          />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-3 pb-3 pt-0 space-y-2 ml-8">
          {issue.explanation && (
            <p className="text-sm text-slate-400">
              {issue.explanation}
            </p>
          )}
          {issue.hint && (
            <div className="flex items-start gap-2 p-2 rounded bg-white/5">
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-400 text-xs mt-0.5" />
              <p className="text-sm text-amber-200">{issue.hint}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FeedbackPanel({ feedback, skillLevel, onAskForHelp }: FeedbackPanelProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set([0])); // First issue expanded by default

  const toggleIssue = (index: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Status badge configuration
  const getStatusConfig = () => {
    switch (feedback.status) {
      case 'correct':
        return {
          text: 'Correct!',
          icon: faCircleCheck,
          colors: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
      case 'almost_there':
        return {
          text: 'Almost there!',
          icon: faThumbsUp,
          colors: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        };
      case 'needs_work':
        return {
          text: 'Needs work',
          icon: faTriangleExclamation,
          colors: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
      case 'major_issues':
        return {
          text: 'Major issues',
          icon: faCircleXmark,
          colors: 'bg-red-500/20 text-red-300 border-red-500/30',
        };
    }
  };

  const statusConfig = getStatusConfig();
  const errors = feedback.issues.filter(i => i.type === 'error');
  const warnings = feedback.issues.filter(i => i.type === 'warning');
  const suggestions = feedback.issues.filter(i => i.type === 'suggestion');

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm border ${statusConfig.colors}`}>
            <FontAwesomeIcon icon={statusConfig.icon} className="text-xs" />
            {statusConfig.text}
          </span>

          {/* Issue counts */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {errors.length > 0 && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faCircleXmark} className="text-red-400" />
                {errors.length}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-400" />
                {warnings.length}
              </span>
            )}
            {suggestions.length > 0 && (
              <span className="flex items-center gap-1">
                <FontAwesomeIcon icon={faLightbulb} className="text-blue-400" />
                {suggestions.length}
              </span>
            )}
          </div>
        </div>

        {feedback.aiUsed && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <FontAwesomeIcon icon={faRobot} />
            AI-powered feedback
          </span>
        )}
      </div>

      {/* Issues list */}
      {feedback.issues.length > 0 && (
        <div className="p-3 space-y-2">
          {feedback.issues.map((issue, index) => (
            <IssueCard
              key={index}
              issue={issue}
              expanded={expandedIssues.has(index)}
              onToggle={() => toggleIssue(index)}
            />
          ))}
        </div>
      )}

      {/* Positives (for encouraging learners) */}
      {feedback.positives && feedback.positives.length > 0 && skillLevel === 'beginner' && (
        <div className="p-3 border-t border-white/10 bg-emerald-500/5">
          <p className="text-sm font-medium text-emerald-300 mb-2">What you did well:</p>
          <ul className="space-y-1">
            {feedback.positives.map((positive, index) => (
              <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-400 text-xs" />
                {positive}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next step suggestion */}
      {feedback.nextStep && !feedback.isCorrect && (
        <div className="p-3 border-t border-white/10 bg-blue-500/5">
          <p className="text-sm text-blue-300">
            <span className="font-medium">Next step: </span>
            {feedback.nextStep}
          </p>
        </div>
      )}

      {/* Ask for help button */}
      {!feedback.isCorrect && onAskForHelp && (
        <div className="p-3 border-t border-white/10">
          <button
            onClick={onAskForHelp}
            className="w-full px-4 py-2 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faRobot} className="mr-2" />
            Ask Sage for more help
          </button>
        </div>
      )}
    </div>
  );
}

export default FeedbackPanel;

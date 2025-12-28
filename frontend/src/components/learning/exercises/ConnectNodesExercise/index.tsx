/**
 * ConnectNodesExercise - Visual puzzle exercise for connecting related concepts
 * TODO: Implement full SVG-based connection drawing with tap-to-connect for mobile
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faProjectDiagram,
  faCheck,
  faRotateRight,
  faLightbulb,
} from '@fortawesome/free-solid-svg-icons';

import { AnimatedContainer } from '../primitives/AnimatedContainer';
import { CheckmarkAnimation } from '../primitives/SuccessParticles';
import { useExerciseState } from '../primitives/useExerciseState';
import type { BaseExerciseProps, ConnectNodesExerciseData, NodeConnection } from '../types';
import { cn } from '@/lib/utils';

interface ConnectNodesExerciseProps extends BaseExerciseProps {
  exercise: BaseExerciseProps['exercise'] & {
    connectNodesData: ConnectNodesExerciseData;
  };
}

export function ConnectNodesExercise({
  exercise,
  skillLevel,
  onComplete,
  onAskForHelp,
}: ConnectNodesExerciseProps) {
  const { connectNodesData } = exercise;
  const { nodes, expectedConnections, presetConnections = [] } = connectNodesData;

  // Get content for current skill level
  const content = exercise.contentByLevel[skillLevel] ||
    exercise.contentByLevel.beginner ||
    { instructions: exercise.scenario, hints: [] };

  // Exercise state
  const {
    attempts,
    isCompleted,
    showConfetti,
    feedback,
    revealedHints,
    hasMoreHints,
    config,
    incrementAttempts,
    revealNextHint,
    markCompleted,
    reset,
    showWrongFeedback,
  } = useExerciseState({
    skillLevel,
    hints: content.hints,
    onComplete,
  });

  // User's connections
  const [userConnections, setUserConnections] = useState<NodeConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Handle node click (tap-to-connect pattern)
  const handleNodeClick = useCallback((nodeId: string) => {
    if (isCompleted) return;

    if (selectedNode === null) {
      // First click - select the node
      setSelectedNode(nodeId);
    } else if (selectedNode === nodeId) {
      // Click same node - deselect
      setSelectedNode(null);
    } else {
      // Second click - create connection
      const newConnection: NodeConnection = {
        fromId: selectedNode,
        toId: nodeId,
      };

      // Check if this connection already exists
      const exists = userConnections.some(
        conn =>
          (conn.fromId === newConnection.fromId && conn.toId === newConnection.toId) ||
          (conn.fromId === newConnection.toId && conn.toId === newConnection.fromId)
      );

      if (!exists) {
        setUserConnections(prev => [...prev, newConnection]);
      }

      setSelectedNode(null);
    }
  }, [selectedNode, userConnections, isCompleted]);

  // Remove a connection
  const removeConnection = useCallback((index: number) => {
    setUserConnections(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Validate connections
  const validateAnswer = useCallback(() => {
    incrementAttempts();

    // Check if all expected connections are made
    const correctCount = expectedConnections.filter(expected =>
      userConnections.some(
        user =>
          (user.fromId === expected.fromId && user.toId === expected.toId) ||
          (user.fromId === expected.toId && user.toId === expected.fromId)
      )
    ).length;

    if (correctCount === expectedConnections.length) {
      markCompleted({
        correctConnections: correctCount,
        totalConnections: expectedConnections.length,
      });
    } else {
      showWrongFeedback(
        `${correctCount} of ${expectedConnections.length} connections are correct.`,
        config.showCorrectOnError ? 'Some connections may need adjustment.' : undefined
      );
    }
  }, [
    userConnections, expectedConnections, incrementAttempts, markCompleted,
    showWrongFeedback, config.showCorrectOnError
  ]);

  // Reset exercise
  const handleReset = () => {
    reset();
    setUserConnections([]);
    setSelectedNode(null);
  };

  return (
    <div className="space-y-4">
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          colors={['#4ade80', '#22d3ee', '#f59e0b', '#ec4899', '#8b5cf6']}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}

      {/* Instructions */}
      <div className="p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
        <div className="flex items-start gap-3">
          <FontAwesomeIcon icon={faProjectDiagram} className="text-purple-500 dark:text-purple-400 mt-1" />
          <div>
            <h4 className="font-medium text-gray-900 dark:text-slate-200 mb-1">Instructions</h4>
            <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{content.instructions}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              Click a node to select it, then click another node to create a connection.
            </p>
          </div>
        </div>
      </div>

      {/* Puzzle area */}
      <div className="relative w-full h-[400px] rounded-lg bg-gray-100 dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 overflow-hidden">
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Preset connections */}
          {presetConnections.map((conn, index) => {
            const fromNode = nodes.find(n => n.id === conn.fromId);
            const toNode = nodes.find(n => n.id === conn.toId);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={`preset-${index}`}
                x1={`${fromNode.position.x}%`}
                y1={`${fromNode.position.y}%`}
                x2={`${toNode.position.x}%`}
                y2={`${toNode.position.y}%`}
                stroke="rgba(148, 163, 184, 0.3)"
                strokeWidth="2"
                strokeDasharray="4"
              />
            );
          })}

          {/* User connections */}
          {userConnections.map((conn, index) => {
            const fromNode = nodes.find(n => n.id === conn.fromId);
            const toNode = nodes.find(n => n.id === conn.toId);
            if (!fromNode || !toNode) return null;

            const isCorrect = expectedConnections.some(
              e =>
                (e.fromId === conn.fromId && e.toId === conn.toId) ||
                (e.fromId === conn.toId && e.toId === conn.fromId)
            );

            return (
              <motion.line
                key={`user-${index}`}
                x1={`${fromNode.position.x}%`}
                y1={`${fromNode.position.y}%`}
                x2={`${toNode.position.x}%`}
                y2={`${toNode.position.y}%`}
                stroke={isCompleted ? (isCorrect ? '#4ade80' : '#f87171') : '#22d3ee'}
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4 }}
                onClick={() => !isCompleted && removeConnection(index)}
                className="cursor-pointer pointer-events-auto hover:stroke-pink-400"
              />
            );
          })}
        </svg>

        {/* Nodes - click to select, not draggable */}
        {nodes.map(node => {
          const isSelected = selectedNode === node.id;
          const hasConnection = userConnections.some(
            c => c.fromId === node.id || c.toId === node.id
          );

          return (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              disabled={isCompleted}
              className={cn(
                'absolute px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                'transform -translate-x-1/2 -translate-y-1/2',
                isSelected
                  ? 'bg-cyan-100 dark:bg-cyan-500/30 border-2 border-cyan-500 dark:border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] ring-2 ring-cyan-400/50'
                  : hasConnection
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-2 border-emerald-400 dark:border-emerald-500/50'
                    : 'bg-white dark:bg-white/10 border border-gray-300 dark:border-white/20 hover:border-cyan-400 dark:hover:border-cyan-400/60 hover:bg-cyan-50 dark:hover:bg-cyan-500/10',
                isCompleted ? 'cursor-default' : 'cursor-pointer'
              )}
              style={{
                left: `${node.position.x}%`,
                top: `${node.position.y}%`,
              }}
            >
              <span className="text-gray-800 dark:text-slate-200">{node.label}</span>
            </button>
          );
        })}
      </div>

      {/* Connection count */}
      <div className="text-sm text-gray-500 dark:text-slate-400">
        Connections made: {userConnections.length} / {expectedConnections.length}
      </div>

      {/* Hints */}
      {revealedHints.length > 0 && (
        <AnimatedContainer variant="default" className="p-4">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon icon={faLightbulb} className="text-amber-500 dark:text-amber-400 mt-1" />
            <div className="space-y-2">
              {revealedHints.map((hint, index) => (
                <p key={index} className="text-sm text-amber-700 dark:text-amber-200/80">{hint}</p>
              ))}
            </div>
          </div>
        </AnimatedContainer>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AnimatedContainer
              variant={feedback.isCorrect ? 'success' : 'error'}
              className="p-4"
            >
              <div className="flex items-center gap-3">
                {feedback.isCorrect ? (
                  <CheckmarkAnimation isVisible size="md" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <span className="text-red-500 dark:text-red-400 text-sm">!</span>
                  </div>
                )}
                <div>
                  <p className={cn(
                    'font-medium',
                    feedback.isCorrect ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'
                  )}>
                    {feedback.isCorrect ? exercise.successMessage || 'Great job!' : feedback.message}
                  </p>
                </div>
              </div>
            </AnimatedContainer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!isCompleted ? (
          <>
            <button
              onClick={validateAnswer}
              disabled={userConnections.length === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                userConnections.length === 0
                  ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white'
              )}
            >
              <FontAwesomeIcon icon={faCheck} />
              Check Connections
            </button>

            {hasMoreHints && (
              <button
                onClick={revealNextHint}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors"
              >
                <FontAwesomeIcon icon={faLightbulb} />
                Hint ({revealedHints.length}/{config.maxHints})
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <FontAwesomeIcon icon={faRotateRight} />
              Reset
            </button>

            {onAskForHelp && (
              <button
                onClick={onAskForHelp}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-colors"
              >
                <img src="/sage-avatar.png" alt="Sage" className="w-5 h-5 rounded-full" />
                Ask Sage
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <FontAwesomeIcon icon={faRotateRight} />
            Try Again
          </button>
        )}
      </div>

      {/* Completion stats */}
      {isCompleted && (
        <AnimatedContainer variant="success" className="p-4">
          <p className="text-sm text-emerald-700 dark:text-emerald-200/70">
            Completed in {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            {revealedHints.length > 0 && ` using ${revealedHints.length} ${revealedHints.length === 1 ? 'hint' : 'hints'}`}.
          </p>
        </AnimatedContainer>
      )}
    </div>
  );
}

export default ConnectNodesExercise;

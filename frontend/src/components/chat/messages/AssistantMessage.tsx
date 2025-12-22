/**
 * AssistantMessage - Displays AI assistant's chat message
 *
 * Features:
 * - Markdown rendering with ReactMarkdown
 * - Internal link navigation (closes chat and navigates)
 * - External links open in new tab
 * - Code highlighting
 * - Optional GitHub connect button when AI asks user to connect
 * - Optional learning content cards below the message
 * - Optional inline game widget below cards (consolidated from find_content)
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faFigma } from '@fortawesome/free-brands-svg-icons';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import { LinkIcon } from '@heroicons/react/24/outline';
import type { AssistantMessageProps } from '../core/types';
import { LearningTeaserCard } from '../cards';
import { ChatGameCard } from '../games';
import { ChatErrorBoundary } from '../ChatErrorBoundary';
import { isFigmaUrl } from '@/services/figma';

export function AssistantMessage({
  content,
  variant = 'default',
  onNavigate,
  showGitHubConnectButton = false,
  onConnectGitHub,
  showFigmaConnectButton = false,
  onConnectFigma,
  showFigmaUrlInput = false,
  onFigmaUrlSubmit,
  learningContent,
  onOpenProjectPreview,
}: AssistantMessageProps) {
  const isNeon = variant === 'neon';
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaUrlError, setFigmaUrlError] = useState<string | null>(null);
  const [isSubmittingFigma, setIsSubmittingFigma] = useState(false);

  const handleFigmaUrlChange = (value: string) => {
    setFigmaUrl(value);
    if (value.trim() && !isFigmaUrl(value)) {
      setFigmaUrlError('Please enter a valid Figma URL (e.g., figma.com/design/... or figma.com/file/...)');
    } else {
      setFigmaUrlError(null);
    }
  };

  const handleFigmaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!figmaUrl.trim() || !isFigmaUrl(figmaUrl) || !onFigmaUrlSubmit) return;
    setIsSubmittingFigma(true);
    setFigmaUrlError(null); // Clear previous errors
    try {
      await onFigmaUrlSubmit(figmaUrl);
    } catch (error: unknown) {
      // Show error to user
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to import Figma file. Please check your access and try again.';
      setFigmaUrlError(errorMessage);
    } finally {
      setIsSubmittingFigma(false);
    }
  };

  // Split content: extract learning path offer to render after cards/game
  const learningPathPattern = /\n\n(Would you like me to (?:create|save) (?:a |this as a )?(?:personalized )?learning path[^?]*\?)/i;
  const match = content.match(learningPathPattern);
  const mainContent = match ? content.replace(learningPathPattern, '') : content;
  const learningPathOffer = match ? match[1] : null;
  const hasLearningContent = learningContent && (learningContent.items?.length > 0 || learningContent.inlineGame);

  // Markdown link handler
  const handleLinkClick = (href: string | undefined, e: React.MouseEvent) => {
    if (!href) return;

    const isInternal = href.startsWith('/');
    if (isInternal && onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  // Render learning content cards
  const renderLearningCards = () => {
    if (!learningContent || !learningContent.items || learningContent.items.length === 0) {
      return null;
    }

    return (
      <div className="mt-4">
        <p className={`text-sm mb-2 ${isNeon ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          Here are some <span className="text-cyan-400 font-medium">{learningContent.topicDisplay}</span> resources:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {learningContent.items.map((item) => (
            <LearningTeaserCard
              key={item.id}
              item={{
                id: item.id,
                title: item.title,
                description: item.description,
                url: item.url,
                thumbnail: item.thumbnail,
                featured_image_url: item.featured_image_url || item.featuredImageUrl,
                author_username: item.author_username,
                author_avatar_url: item.author_avatar_url,
                key_techniques: item.key_techniques,
                difficulty: item.difficulty,
                question_count: item.question_count,
                slug: item.slug,
              }}
              contentType={learningContent.contentType}
              onNavigate={onNavigate}
              onOpenProjectPreview={onOpenProjectPreview}
              compact
            />
          ))}
        </div>
      </div>
    );
  };

  // Render inline game widget (consolidated from find_content)
  const renderInlineGame = () => {
    if (!learningContent?.inlineGame) {
      return null;
    }

    const { gameType, gameConfig } = learningContent.inlineGame;
    const topicDisplay = learningContent.topicDisplay || 'this topic';

    return (
      <div className="mt-4">
        <p className={`text-sm mb-2 ${isNeon ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
          Here's a fun game about <span className="text-cyan-400 font-medium">{topicDisplay}</span>:
        </p>
        <ChatErrorBoundary inline resetKey={`inline-game-${gameType}`}>
          <ChatGameCard gameType={gameType} config={gameConfig} />
        </ChatErrorBoundary>
      </div>
    );
  };

  // Render Figma connect button or URL input
  const renderFigmaAction = () => {
    if (showFigmaConnectButton && onConnectFigma) {
      return (
        <div className={`mt-3 pt-3 border-t ${isNeon ? 'border-white/10' : 'border-slate-200 dark:border-slate-700'}`}>
          <button
            onClick={onConnectFigma}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faFigma} />
            Connect Figma
          </button>
        </div>
      );
    }

    if (showFigmaUrlInput && onFigmaUrlSubmit) {
      return (
        <div className={`mt-3 pt-3 border-t ${isNeon ? 'border-white/10' : 'border-slate-200 dark:border-slate-700'}`}>
          <form onSubmit={handleFigmaSubmit} className="space-y-2">
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="url"
                value={figmaUrl}
                onChange={(e) => handleFigmaUrlChange(e.target.value)}
                placeholder="https://www.figma.com/design/..."
                disabled={isSubmittingFigma}
                className={`w-full pl-9 pr-4 py-2 bg-slate-800/50 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none ${
                  figmaUrlError
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-slate-700 focus:border-purple-500'
                } disabled:opacity-50`}
              />
            </div>
            {figmaUrlError && (
              <p className="text-xs text-red-400">{figmaUrlError}</p>
            )}
            <button
              type="submit"
              disabled={!figmaUrl.trim() || !!figmaUrlError || isSubmittingFigma}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSubmittingFigma ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Importing...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFigma} />
                  Import Design
                </>
              )}
            </button>
          </form>
          <p className="text-xs text-slate-500 text-center mt-2">
            Supported: Figma design files, prototypes, and FigJam boards
          </p>
        </div>
      );
    }

    return null;
  };

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex justify-start w-full">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-cyan-500 dark:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="glass-message px-5 py-4 rounded-2xl rounded-bl-sm">
            <div className="text-lg text-slate-700 dark:text-slate-200 prose prose-lg prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  a: ({ href, children }) => {
                    const isInternal = href?.startsWith('/');
                    if (isInternal) {
                      return (
                        <a
                          href={href}
                          onClick={(e) => handleLinkClick(href, e)}
                          className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline cursor-pointer"
                        >
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 hover:underline"
                      >
                        {children}
                      </a>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-slate-900/50 dark:bg-slate-950/50 p-3 rounded-lg text-sm my-2">{children}</pre>
                  ),
                  code: ({ children, node }) => {
                    const isInline = node?.position?.start.line === node?.position?.end.line;
                    return isInline ? (
                      <code className="bg-slate-200/50 dark:bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono break-all">{children}</code>
                    ) : (
                      <code className="break-words">{children}</code>
                    );
                  },
                }}
              >
                {mainContent}
              </ReactMarkdown>
            </div>
            {showGitHubConnectButton && onConnectGitHub && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
                <button
                  onClick={onConnectGitHub}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <FontAwesomeIcon icon={faGithub} />
                  Connect GitHub
                </button>
              </div>
            )}
            {renderFigmaAction()}
          </div>
          {renderLearningCards()}
          {renderInlineGame()}
          {/* Learning path offer rendered after cards and game */}
          {learningPathOffer && hasLearningContent && (
            <p className="mt-4 text-lg text-slate-700 dark:text-slate-200">{learningPathOffer}</p>
          )}
        </div>
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[85%]">
        <div className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                a: ({ href, children }) => {
                  const isInternal = href?.startsWith('/');
                  if (isInternal) {
                    return (
                      <a
                        href={href}
                        onClick={(e) => handleLinkClick(href, e)}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                      >
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      {children}
                    </a>
                  );
                },
                pre: ({ children }) => (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-slate-900 dark:bg-slate-950 p-3 rounded-lg text-sm my-2">{children}</pre>
                ),
                code: ({ children, node }) => {
                  const isInline = node?.position?.start.line === node?.position?.end.line;
                  return isInline ? (
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm break-all">{children}</code>
                  ) : (
                    <code className="text-slate-300 break-words">{children}</code>
                  );
                },
              }}
            >
              {mainContent}
            </ReactMarkdown>
          </div>
          {showGitHubConnectButton && onConnectGitHub && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={onConnectGitHub}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <FontAwesomeIcon icon={faGithub} />
                Connect GitHub
              </button>
            </div>
          )}
          {renderFigmaAction()}
        </div>
        {renderLearningCards()}
        {renderInlineGame()}
        {/* Learning path offer rendered after cards and game */}
        {learningPathOffer && hasLearningContent && (
          <p className="mt-4 text-sm text-slate-900 dark:text-slate-100">{learningPathOffer}</p>
        )}
      </div>
    </div>
  );
}

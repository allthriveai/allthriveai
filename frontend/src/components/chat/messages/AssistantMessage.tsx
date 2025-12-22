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

import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import type { AssistantMessageProps } from '../core/types';
import { LearningTeaserCard } from '../cards';
import { ChatGameCard } from '../games';
import { ChatErrorBoundary } from '../ChatErrorBoundary';

export function AssistantMessage({
  content,
  variant = 'default',
  onNavigate,
  showGitHubConnectButton = false,
  onConnectGitHub,
  learningContent,
}: AssistantMessageProps) {
  const isNeon = variant === 'neon';

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
                  code: ({ children, node }) => {
                    const isInline = node?.position?.start.line === node?.position?.end.line;
                    return isInline ? (
                      <code className="bg-slate-200/50 dark:bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                    ) : (
                      <code>{children}</code>
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
                code: ({ children, node }) => {
                  const isInline = node?.position?.start.line === node?.position?.end.line;
                  return isInline ? (
                    <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">{children}</code>
                  ) : (
                    <code>{children}</code>
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

/**
 * AssistantMessage - Displays AI assistant's chat message
 *
 * Features:
 * - Markdown rendering with ReactMarkdown
 * - Internal link navigation (closes chat and navigates)
 * - External links open in new tab
 * - Code highlighting
 * - Optional GitHub connect button when AI asks user to connect
 * - Two variants: default (sidebar) and neon (EmberHomePage)
 */

import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { faDragon } from '@fortawesome/free-solid-svg-icons';
import type { AssistantMessageProps } from '../core/types';

export function AssistantMessage({
  content,
  variant = 'default',
  onNavigate,
  showGitHubConnectButton = false,
  onConnectGitHub,
}: AssistantMessageProps) {
  const isNeon = variant === 'neon';

  // Markdown link handler
  const handleLinkClick = (href: string | undefined, e: React.MouseEvent) => {
    if (!href) return;

    const isInternal = href.startsWith('/');
    if (isInternal && onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  if (isNeon) {
    // Neon Glass variant (EmberHomePage)
    return (
      <div className="flex justify-start">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center flex-shrink-0 mr-4">
          <FontAwesomeIcon icon={faDragon} className="w-6 h-6 text-orange-500 dark:text-orange-400" />
        </div>
        <div className="flex-1 glass-subtle px-5 py-4 rounded-2xl rounded-bl-sm">
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
              {content}
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
      </div>
    );
  }

  // Default variant (sidebar)
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700">
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
            {content}
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
    </div>
  );
}

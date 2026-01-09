/**
 * CollectiveHomePage - Placeholder home page for AI Collective pivot
 *
 * Sprint 1: Simple welcome with tagline and Ava chat sidebar
 * Sprint 4: Will be replaced with real dashboard showing offers/asks
 *
 * PHASE_1: This is the new home page during the collective rebuild
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { EmbeddedChatLayout } from '@/components/chat/layouts';
import { useStableConversationId } from '@/hooks/useStableConversationId';
import { useAuth } from '@/hooks/useAuth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandshake, faLightbulb, faArrowRight } from '@fortawesome/free-solid-svg-icons';

function CollectiveHomeContent() {
  const { user } = useAuth();
  const conversationId = useStableConversationId({ context: 'collective-home' });

  // Ensure page starts at top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const _firstName = user?.firstName || user?.username || 'there'; // TODO: Use in Sprint 4 dashboard

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8">
      {/* Main content area */}
      <div className="flex-1 flex flex-col justify-center max-w-2xl">
        {/* Welcome section */}
        <div className="space-y-6">
          {/* Tagline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold">
              <span className="text-slate-900 dark:text-white">Welcome to the </span>
              <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-green-400 bg-clip-text text-transparent">
                AI Collective
              </span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Share what you offer. Ask for what you need.
            </p>
          </div>

          {/* Value props */}
          <div className="grid gap-4 sm:grid-cols-2 mt-8">
            <div className="glass-subtle p-5 rounded-xl border border-cyan-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-green-500/20 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faHandshake} className="text-cyan-500 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Offer</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Share your apps, skills, courses, and services with the community.
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-subtle p-5 rounded-xl border border-purple-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faLightbulb} className="text-purple-500 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Ask</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Get help with what you're building. Find beta testers, feedback, and collaborators.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA section */}
          <div className="mt-8 p-6 glass-subtle rounded-xl border border-slate-200 dark:border-cyan-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Get started with Ava
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Chat with Ava to set up your profile and discover the community.
                </p>
              </div>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 text-white font-medium hover:from-cyan-600 hover:to-green-600 transition-all shadow-lg hover:shadow-cyan-500/25"
              >
                Complete Setup
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </Link>
            </div>
          </div>

          {/* Coming soon note */}
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-6">
            More features coming soon: Discovery, Creator Profiles, and Connections.
          </p>
        </div>
      </div>

      {/* Ava chat sidebar - hidden on mobile, shown on desktop */}
      <div className="hidden lg:block w-[400px] flex-shrink-0">
        <div className="sticky top-24 h-[calc(100vh-10rem)] glass-subtle rounded-2xl border border-slate-200 dark:border-cyan-500/20 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-cyan-500/20">
              <div className="flex items-center gap-3">
                <img
                  src="/ava-avatar.png"
                  alt="Ava"
                  className="w-8 h-8 rounded-full object-cover -scale-x-100"
                />
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Chat with Ava</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Your AI guide</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmbeddedChatLayout conversationId={conversationId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CollectiveHomePage() {
  return (
    <DashboardLayout>
      <CollectiveHomeContent />
    </DashboardLayout>
  );
}

/**
 * Chrome Extension Landing Page
 *
 * Coming soon page for the AllThrive Chrome extension.
 */

import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChrome, faPuzzlePiece, faBookmark, faShare } from '@fortawesome/free-solid-svg-icons';

export default function ExtensionPage() {
  return (
    <DashboardLayout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faChrome} className="text-4xl text-cyan-400" />
          </motion.div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-3">
            Chrome Extension
          </h1>

          {/* Coming Soon Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-amber-400 text-sm font-medium">Coming Soon</span>
          </motion.div>

          {/* Description */}
          <p className="text-slate-400 mb-8">
            Save AI-generated content from anywhere on the web directly to your AllThrive portfolio.
          </p>

          {/* Features Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
            >
              <FontAwesomeIcon icon={faBookmark} className="text-cyan-400 text-xl mb-2" />
              <p className="text-sm text-slate-300">Save content instantly</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
            >
              <FontAwesomeIcon icon={faPuzzlePiece} className="text-violet-400 text-xl mb-2" />
              <p className="text-sm text-slate-300">Auto-detect AI tools</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
            >
              <FontAwesomeIcon icon={faShare} className="text-emerald-400 text-xl mb-2" />
              <p className="text-sm text-slate-300">Share to portfolio</p>
            </motion.div>
          </div>

          {/* Notify Me (placeholder) */}
          <p className="text-sm text-slate-500">
            Check back soon or follow us for updates!
          </p>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

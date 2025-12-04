import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CircularGallery } from '@/components/ui/CircularGallery';
import type { GalleryItem } from '@/components/ui/CircularGallery';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

// Gallery items for the circular carousel
const galleryItems: GalleryItem[] = [
  {
    id: 1,
    title: 'AI-Powered Code Assistant',
    description: 'A VSCode extension that uses GPT-4 to help you write better code faster',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=800&fit=crop',
    username: 'techbuilder',
    heartCount: 342,
    tags: ['VSCode', 'GPT-4', 'Productivity'],
  },
  {
    id: 2,
    title: 'Neural Style Transfer',
    description: 'Transform photos into artistic masterpieces',
    gradient: { from: '#6366f1', to: '#ec4899' },
    username: 'artcreator',
    heartCount: 256,
    tags: ['Art', 'Neural Networks'],
  },
  {
    id: 3,
    title: 'Multi-Modal Chatbot',
    description: 'Understands text, images, and voice',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=800&fit=crop',
    username: 'aiexplorer',
    heartCount: 189,
    tags: ['Chatbot', 'Multi-modal'],
  },
  {
    id: 4,
    title: 'AI Music Composer',
    description: 'Generate original music with ML',
    gradient: { from: '#22d3ee', to: '#4ade80' },
    username: 'soundwave',
    heartCount: 423,
    tags: ['Music', 'Generation'],
  },
  {
    id: 5,
    title: 'Smart Document Analyzer',
    description: 'Extract insights from documents using AI',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=800&fit=crop',
    username: 'datawhiz',
    heartCount: 178,
    tags: ['Documents', 'Analysis'],
  },
  {
    id: 6,
    title: 'AI Video Editor',
    description: 'Intelligent scene detection and transitions',
    gradient: { from: '#f43f5e', to: '#f97316' },
    username: 'videocreator',
    heartCount: 567,
    tags: ['Video', 'Automation'],
  },
  {
    id: 7,
    title: 'Prompt Library Manager',
    description: 'Organize and share your best prompts',
    gradient: { from: '#8b5cf6', to: '#06b6d4' },
    username: 'promptmaster',
    heartCount: 312,
    tags: ['Prompts', 'Organization'],
  },
  {
    id: 8,
    title: 'AI Avatar Generator',
    description: 'Create unique avatars from text descriptions',
    imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&h=800&fit=crop',
    username: 'avatarmaker',
    heartCount: 445,
    tags: ['Avatars', 'Generation'],
  },
];

export function ExplorePreview() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0a1628] to-[#020617]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Discover{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
              AI Projects
            </span>
          </h2>
          <p className="text-lg text-gray-400">
            Get inspired by innovative AI projects from our community.
          </p>
        </motion.div>

        {/* Circular Gallery */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <CircularGallery items={galleryItems} radius={400} autoRotateSpeed={0.012} />
        </motion.div>

        {/* See more link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-8"
        >
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-sm border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-medium hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 group"
          >
            Explore All Projects
            <ArrowRightIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute right-0 top-1/3 w-48 h-48 bg-green-500/5 rounded-full blur-3xl" />
    </section>
  );
}

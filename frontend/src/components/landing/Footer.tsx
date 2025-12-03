import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXTwitter, faGithub, faDiscord } from '@fortawesome/free-brands-svg-icons';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface FooterProps {
  onOpenChat?: () => void;
}

export function Footer({ onOpenChat }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const navigation = {
    product: [
      { name: 'Explore Projects', href: '/explore' },
      { name: 'Pricing', href: '/pricing' },
    ],
    company: [
      { name: 'About', href: '/about' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
    ],
    social: [
      { name: 'Twitter', icon: faXTwitter, href: 'https://twitter.com/allthriveai' },
      { name: 'GitHub', icon: faGithub, href: 'https://github.com/allthriveai' },
      { name: 'Discord', icon: faDiscord, href: 'https://discord.gg/allthriveai' },
    ],
  };

  return (
    <footer className="relative bg-[#020617] border-t border-white/5" role="contentinfo">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:justify-between gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="md:max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
                All Thrive
              </span>
            </Link>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              The community platform for AI creators. Showcase your projects,
              learn through gamified challenges, and grow with a community
              built for the AI era.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3">
              {navigation.social.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300"
                  aria-label={`Follow us on ${item.name}`}
                >
                  <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <nav aria-label="Explore">
            <h3 className="text-white font-semibold mb-4">Explore</h3>
            <ul className="space-y-3">
              {navigation.product.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* About links */}
          <nav aria-label="About">
            <h3 className="text-white font-semibold mb-4">About</h3>
            <ul className="space-y-3">
              {navigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={onOpenChat}
                  className="text-gray-400 hover:text-cyan-400 transition-colors text-sm inline-flex items-center gap-2 group"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 group-hover:text-cyan-400" />
                  Contact Us
                </button>
              </li>
              {navigation.legal.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {currentYear} All Thrive. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs">
            Create anywhere. Consolidate here. Thrive together.
          </p>
        </div>
      </div>

      {/* Decorative gradient */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.3), transparent)',
        }}
      />
    </footer>
  );
}

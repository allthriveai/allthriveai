/**
 * Skip to main content link for keyboard accessibility.
 * This is the first focusable element on the page, allowing
 * keyboard users to skip navigation and go directly to content.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-400 focus:text-[#020617] focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#020617] transition-all"
    >
      Skip to main content
    </a>
  );
}

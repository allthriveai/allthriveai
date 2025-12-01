/**
 * HeroQuote - Quote display mode for project hero
 *
 * Displays a large quote with responsive font sizing based on text length.
 */

interface HeroQuoteProps {
  quote: string;
}

export function HeroQuote({ quote }: HeroQuoteProps) {
  if (!quote) return null;

  // Calculate font size based on text length for better fit
  const textLength = quote.trim().length;
  let fontSize: string;

  if (textLength < 100) {
    fontSize = 'clamp(1.5rem, 3vw, 3rem)'; // Short text - large
  } else if (textLength < 200) {
    fontSize = 'clamp(1.25rem, 2.5vw, 2.25rem)'; // Medium-short text
  } else if (textLength < 400) {
    fontSize = 'clamp(1rem, 2vw, 1.75rem)'; // Medium text
  } else if (textLength < 700) {
    fontSize = 'clamp(0.875rem, 1.5vw, 1.25rem)'; // Long text
  } else {
    fontSize = 'clamp(0.75rem, 1.25vw, 1rem)'; // Very long text
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="relative group">
        {/* Glowing backdrop */}
        <div className="absolute -inset-2 md:-inset-4 bg-gradient-to-r from-primary-500/20 to-secondary-500/20 rounded-2xl md:rounded-3xl blur-xl md:blur-2xl opacity-50 group-hover:opacity-70 transition duration-500" />

        {/* Quote container */}
        <div className="relative p-6 md:p-8 lg:p-10 bg-white/5 backdrop-blur-md rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl max-h-[80vh] overflow-y-auto">
          <p
            className="font-light text-white leading-relaxed text-center relative z-10"
            style={{ fontSize, lineHeight: '1.45' }}
          >
            "{quote.trim()}"
          </p>
        </div>
      </div>
    </div>
  );
}

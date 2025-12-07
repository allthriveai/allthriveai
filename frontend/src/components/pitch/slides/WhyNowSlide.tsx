import { motion } from 'framer-motion';
import { PitchSlide, GradientText } from '../PitchSlide';

const narrative = [
  { text: 'Three years ago, there was ChatGPT.', delay: 0.3 },
  { text: 'Then came Midjourney. DALL-E. Claude. Runway. Gemini.', delay: 0.8 },
  { text: 'Today, there are thousands of AI tools.', delay: 1.4, highlight: true },
  { text: 'Every week, another breakthrough.', delay: 2.0 },
];

const tension = 'But creators are overwhelmed.';
const resolution = 'They need a vendor-neutral home to learn, explore their creativity, and connect with other AI creators.';

export function WhyNowSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">
            Why <GradientText>Now</GradientText>?
          </h2>
        </motion.div>

        {/* Narrative flow */}
        <div className="space-y-6 mb-12">
          {narrative.map((line, index) => (
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: line.delay }}
              className={`text-xl sm:text-2xl text-center ${
                line.highlight ? 'text-white font-semibold' : 'text-gray-400'
              }`}
            >
              {line.text}
            </motion.p>
          ))}
        </div>

        {/* Tension */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 2.6 }}
          className="text-center mb-8"
        >
          <p className="text-2xl sm:text-3xl text-orange-400 font-medium">
            {tension}
          </p>
        </motion.div>

        {/* Resolution */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 3.2 }}
          className="text-center"
        >
          <p className="text-2xl sm:text-3xl font-semibold">
            <GradientText>{resolution}</GradientText>
          </p>
        </motion.div>
      </div>
    </PitchSlide>
  );
}

import { motion } from 'framer-motion';
import { PitchSlide, GradientText } from '../PitchSlide';

const revenueStreams = [
  { name: 'Subscriptions', key: 'subscriptions', color: '#06b6d4' },
  { name: 'Tokens', key: 'tokens', color: '#a855f7' },
  { name: 'Marketplace', key: 'marketplace', color: '#22c55e' },
  { name: 'Partnerships', key: 'partnerships', color: '#f97316' },
];

// Revenue by stream per year (heights as percentages of max)
const yearData = [
  { year: 'Y1', total: '$2M', subscriptions: 60, tokens: 50, marketplace: 15, partnerships: 5 },
  { year: 'Y2', total: '$8M', subscriptions: 70, tokens: 55, marketplace: 30, partnerships: 15 },
  { year: 'Y3', total: '$25M', subscriptions: 75, tokens: 50, marketplace: 55, partnerships: 35 },
  { year: 'Y4', total: '$55M', subscriptions: 70, tokens: 40, marketplace: 75, partnerships: 65 },
  { year: 'Y5', total: '$100M', subscriptions: 60, tokens: 30, marketplace: 90, partnerships: 100 },
];

export function RevenueProjectionsSlide() {
  return (
    <PitchSlide>
      <div className="w-full max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-3">
            Revenue <GradientText>Projections</GradientText>
          </h2>
          <p className="text-xl text-gray-400">Path to $100M ARR</p>
        </motion.div>

        {/* Chart area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8"
        >
          {/* Legend */}
          <div className="flex justify-center flex-wrap gap-4 sm:gap-8 mb-8">
            {revenueStreams.map((stream, index) => (
              <motion.div
                key={stream.name}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                className="flex items-center gap-2"
              >
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: stream.color }}
                />
                <span className="text-sm text-gray-300 font-medium">{stream.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Grouped bar chart */}
          <div className="flex items-end justify-around mb-2 px-2">
            {yearData.map((data, yearIndex) => (
              <div key={data.year} className="flex flex-col items-center">
                {/* Bar group */}
                <div className="flex items-end gap-1.5 sm:gap-2 h-48 sm:h-56">
                  {revenueStreams.map((stream, streamIndex) => {
                    const height = data[stream.key as keyof typeof data] as number;
                    return (
                      <motion.div
                        key={stream.name}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${height}%`, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          delay: 0.4 + yearIndex * 0.15 + streamIndex * 0.05,
                          ease: [0.25, 0.1, 0.25, 1]
                        }}
                        className="w-4 sm:w-5 md:w-6 rounded-t"
                        style={{
                          backgroundColor: stream.color,
                          minHeight: height > 0 ? 6 : 0
                        }}
                      />
                    );
                  })}
                </div>
                {/* Year label and total */}
                <div className="mt-4 text-center">
                  <span className="text-white font-semibold text-base block">{data.year}</span>
                  <span className="text-gray-500 text-xs">{data.total}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom insight */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="text-center text-gray-400 mt-6 text-sm max-w-2xl mx-auto"
        >
          Subscriptions & tokens drive early revenue → Marketplace grows with network effects → Enterprise scales at volume
        </motion.p>
      </div>
    </PitchSlide>
  );
}

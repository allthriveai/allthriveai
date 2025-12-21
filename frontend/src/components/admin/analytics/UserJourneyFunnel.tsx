// User Journey Funnel Component - Shows conversion rates from signup through retention
import type { EngagementRetention } from '@/types/analytics';

interface UserJourneyFunnelProps {
  funnel: EngagementRetention['funnel'];
  rates: EngagementRetention['funnelRates'];
}

export function UserJourneyFunnel({ funnel, rates }: UserJourneyFunnelProps) {
  const steps = [
    { label: 'Signed Up', value: funnel.signedUp, rate: 100, color: 'cyan' },
    { label: 'First Action', value: funnel.hadFirstAction, rate: rates.signupToAction, color: 'purple' },
    { label: 'Returned Day 7', value: funnel.returnedDay7, rate: rates.actionToDay7, color: 'teal' },
    { label: 'Returned Day 30', value: funnel.returnedDay30, rate: rates.day7ToDay30, color: 'green' },
  ];

  const maxValue = funnel.signedUp || 1;

  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const widthPercent = (step.value / maxValue) * 100;
        return (
          <div key={step.label}>
            <div className="flex items-center gap-4 mb-2">
              <div className="w-36 text-right">
                <p className="text-sm text-slate-400">{step.label}</p>
                <p className="text-xl font-bold text-white">{step.value.toLocaleString()}</p>
              </div>
              <div className="flex-1 relative h-8">
                <div
                  className={`h-full rounded-lg transition-all duration-500 ${
                    step.color === 'cyan' ? 'bg-cyan-500/20' :
                    step.color === 'purple' ? 'bg-purple-500/20' :
                    step.color === 'teal' ? 'bg-teal-500/20' :
                    'bg-green-500/20'
                  }`}
                  style={{ width: `${Math.max(widthPercent, 3)}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-medium ${
                      step.color === 'cyan' ? 'text-cyan-300' :
                      step.color === 'purple' ? 'text-purple-300' :
                      step.color === 'teal' ? 'text-teal-300' :
                      'text-green-300'
                    }`}>
                      {widthPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center gap-4 pl-36">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <div className="h-px flex-1 bg-slate-600" />
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {i === 0 ? rates.signupToAction : i === 1 ? rates.actionToDay7 : rates.day7ToDay30}% conversion
                  </span>
                  <div className="h-px flex-1 bg-slate-600" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

module.exports = {
  ai: {
    provider: 'azure',
    model: 'gpt-4.1', // Your Azure deployment name from AZURE_OPENAI_DEPLOYMENT_NAME
  },
  testing: {
    runner: 'playwright',
    command: 'cd frontend && npx playwright test e2e/profile-achievements.spec.ts',
    timeout: 300000,
    artifactsDir: 'frontend/test-results',
  },
  intervention: {
    mode: 'autonomous',
  },
  taskMaster: {
    tasksPath: '.taskmaster/tasks/tasks.json',
  },
  debug: false,
  metrics: {
    enabled: true,
    path: '.devloop/metrics.json',
    testResultsPath: '.devloop/test-results',
    reportsPath: '.devloop/reports',
    costTracking: {
      enabled: true,
      provider: 'azure',
    },
  },
  archive: {
    enabled: true,
    defaultPath: '.devloop/archive',
    compress: false,
    preserveStructure: true,
  },
  patternLearning: {
    enabled: true,
    patternsPath: '.devloop/patterns.json',
  },
  // AllThrive-specific: Django + React composite
  framework: {
    type: 'composite', // Auto-detects Django backend + React frontend
  },
};

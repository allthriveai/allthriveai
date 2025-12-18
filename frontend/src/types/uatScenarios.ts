/**
 * TypeScript types for the UAT Scenarios feature.
 */

// Test result options
export type TestResult = 'pass' | 'fail' | 'na' | null;

// UAT Category
export interface UATCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
  order: number;
  isActive: boolean;
  createdAt: string;
}

// Admin user (for tester)
export interface UATScenarioAssignee {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

// UAT Test Run - a single test execution of a scenario
export interface UATTestRun {
  id: number;
  scenario: number;
  dateTested: string;
  result: 'pass' | 'fail' | 'na';
  resultDisplay: string;
  notes: string;
  testedBy: number | null;
  testedByDetail: UATScenarioAssignee | null;
  createdAt: string;
}

// UAT Scenario
export interface UATScenario {
  id: number;
  title: string;
  description: string;
  // FK IDs for writes
  category: number | null;
  // Nested details for reads
  categoryDetail: UATCategory | null;
  createdByDetail: UATScenarioAssignee | null;
  updatedByDetail: UATScenarioAssignee | null;
  // Test runs
  testRuns: UATTestRun[];
  testRunCount: number;
  latestTestRun: UATTestRun | null;
  // Other fields
  order: number;
  isArchived: boolean;
  linkedTask: number | null;
  createdAt: string;
  updatedAt: string;
}

// Create scenario payload
export interface CreateUATScenarioPayload {
  title: string;
  description?: string;
  category?: number | null;
}

// Update scenario payload
export interface UpdateUATScenarioPayload {
  title?: string;
  description?: string;
  category?: number | null;
  isArchived?: boolean;
}

// Create test run payload
export interface CreateUATTestRunPayload {
  scenario: number;
  dateTested: string;
  result: 'pass' | 'fail' | 'na';
  notes?: string;
}

// Update test run payload
export interface UpdateUATTestRunPayload {
  dateTested?: string;
  result?: 'pass' | 'fail' | 'na';
  notes?: string;
}

// Query params for filtering scenarios
export interface UATScenarioQueryParams {
  search?: string;
  latestResult?: string; // 'pass', 'fail', 'na', 'not_tested'
  category?: number;
  archived?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

// Filter state for UI
export interface UATScenarioFilters {
  latestResult?: TestResult | 'not_tested';
  category?: number | null;
  search?: string;
}

// Statistics
export interface UATScenarioStats {
  totalScenarios: number;
  totalTestRuns: number;
  scenariosNeverTested: number;
  latestPassed: number;
  latestFailed: number;
  latestNa: number;
  passRate: number;
  byCategory: Record<string, number>;
}

// Create category payload
export interface CreateUATCategoryPayload {
  name: string;
  color?: string;
}

// Update category payload
export interface UpdateUATCategoryPayload {
  name?: string;
  color?: string;
  order?: number;
  isActive?: boolean;
}

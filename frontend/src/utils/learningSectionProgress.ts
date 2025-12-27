/**
 * Learning Section Progress Calculation
 *
 * Utilities for calculating progress across learning sections containing topics.
 * Progress is calculated frontend-side using a recursive utility.
 */

import type {
  LearningSection,
  TopicSectionData,
  SectionProgress,
  LearningSectionChild,
} from '@/types/learningSections';
import { isLearningSection, isTopicRef } from '@/types/learningSections';

/**
 * Map of topic slug to progress info
 */
export type TopicProgressMap = Record<
  string,
  { completed: number; total: number }
>;

/**
 * Build a topic progress map from topic section data
 * @param topics - Array of topic section data with concepts
 * @returns Map of topic slug to progress counts
 */
export function buildTopicProgressMap(
  topics: TopicSectionData[]
): TopicProgressMap {
  const map: TopicProgressMap = {};

  for (const topic of topics) {
    const completed = topic.concepts.filter((c) => c.isCompleted).length;
    const total = topic.concepts.length;
    map[topic.slug] = { completed, total };
  }

  return map;
}

/**
 * Calculate progress for a single section (recursive)
 * Aggregates progress from all topics and nested sections
 *
 * @param section - The learning section to calculate progress for
 * @param topicProgressMap - Map of topic slug to progress info
 * @returns Progress info with completed, total, and percentage
 */
export function calculateSectionProgress(
  section: LearningSection,
  topicProgressMap: TopicProgressMap
): SectionProgress {
  let completed = 0;
  let total = 0;

  for (const child of section.children) {
    if (isTopicRef(child)) {
      const topicProgress = topicProgressMap[child.topicSlug];
      if (topicProgress) {
        completed += topicProgress.completed;
        total += topicProgress.total;
      }
    } else if (isLearningSection(child)) {
      // Recurse into nested section
      const nestedProgress = calculateSectionProgress(child, topicProgressMap);
      completed += nestedProgress.completed;
      total += nestedProgress.total;
    }
  }

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Calculate overall progress across all sections
 *
 * @param sections - Array of top-level learning sections
 * @param topicProgressMap - Map of topic slug to progress info
 * @returns Progress info with completed, total, and percentage
 */
export function calculateOverallProgress(
  sections: LearningSection[],
  topicProgressMap: TopicProgressMap
): SectionProgress {
  let completed = 0;
  let total = 0;

  for (const section of sections) {
    const sectionProgress = calculateSectionProgress(section, topicProgressMap);
    completed += sectionProgress.completed;
    total += sectionProgress.total;
  }

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Get all topic slugs that are currently organized in sections
 *
 * @param sections - Array of learning sections
 * @returns Set of topic slugs that appear in the sections
 */
export function getOrganizedTopicSlugs(sections: LearningSection[]): Set<string> {
  const slugs = new Set<string>();

  function collectSlugs(children: LearningSectionChild[]) {
    for (const child of children) {
      if (isTopicRef(child)) {
        slugs.add(child.topicSlug);
      } else if (isLearningSection(child)) {
        collectSlugs(child.children);
      }
    }
  }

  for (const section of sections) {
    collectSlugs(section.children);
  }

  return slugs;
}

/**
 * Get topics that are not organized into any section ("unsorted")
 *
 * @param sections - Array of learning sections
 * @param allTopics - All available topics
 * @returns Array of unsorted topic data
 */
export function getUnsortedTopics(
  sections: LearningSection[],
  allTopics: TopicSectionData[]
): TopicSectionData[] {
  const organizedSlugs = getOrganizedTopicSlugs(sections);
  return allTopics.filter((topic) => !organizedSlugs.has(topic.slug));
}

/**
 * Calculate estimated time for a section based on its topics
 *
 * @param section - The learning section
 * @param topicMap - Map of topic slug to topic data
 * @returns Estimated minutes for the section
 */
export function calculateSectionEstimatedTime(
  section: LearningSection,
  topicMap: Record<string, TopicSectionData>
): number {
  let minutes = 0;

  for (const child of section.children) {
    if (isTopicRef(child)) {
      const topic = topicMap[child.topicSlug];
      if (topic?.estimatedMinutes) {
        minutes += topic.estimatedMinutes;
      }
    } else if (isLearningSection(child)) {
      minutes += calculateSectionEstimatedTime(child, topicMap);
    }
  }

  return minutes;
}

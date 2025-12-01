import { describe, it, expect } from 'vitest';
import {
  createDefaultSectionContent,
  generateSectionId,
  isOverviewSection,
  isFeaturesSection,
  isTechStackSection,
  isGallerySection,
  isArchitectureSection,
  isDemoSection,
  isChallengesSection,
  isLinksSection,
  isCustomSection,
  DEFAULT_SECTION_ORDER,
  SECTION_METADATA,
} from './sections';
import type { ProjectSection, SectionType } from './sections';

describe('createDefaultSectionContent', () => {
  it('creates default overview content', () => {
    const content = createDefaultSectionContent('overview');
    expect(content).toHaveProperty('headline');
    expect(content).toHaveProperty('description');
  });

  it('creates default features content with a sample feature', () => {
    const content = createDefaultSectionContent('features');
    expect(content).toHaveProperty('features');
    expect((content as { features: unknown[] }).features.length).toBeGreaterThan(0);
  });

  it('creates default tech_stack content', () => {
    const content = createDefaultSectionContent('tech_stack');
    expect(content).toHaveProperty('categories');
  });

  it('creates default gallery content', () => {
    const content = createDefaultSectionContent('gallery');
    expect(content).toHaveProperty('images');
    expect(content).toHaveProperty('layout');
    expect((content as { layout: string }).layout).toBe('grid');
  });

  it('creates default architecture content', () => {
    const content = createDefaultSectionContent('architecture');
    expect(content).toHaveProperty('diagram');
    expect(content).toHaveProperty('description');
  });

  it('creates default demo content', () => {
    const content = createDefaultSectionContent('demo');
    expect(content).toHaveProperty('ctas');
  });

  it('creates default challenges content', () => {
    const content = createDefaultSectionContent('challenges');
    expect(content).toHaveProperty('items');
  });

  it('creates default links content', () => {
    const content = createDefaultSectionContent('links');
    expect(content).toHaveProperty('links');
  });

  it('creates default custom content', () => {
    const content = createDefaultSectionContent('custom');
    expect(content).toHaveProperty('blocks');
    expect(content).toHaveProperty('title');
  });
});

describe('generateSectionId', () => {
  it('generates unique IDs', () => {
    const id1 = generateSectionId('overview');
    const id2 = generateSectionId('overview');
    expect(id1).not.toBe(id2);
  });

  it('includes section type in ID', () => {
    const id = generateSectionId('features');
    expect(id).toContain('features');
  });

  it('starts with section prefix', () => {
    const id = generateSectionId('architecture');
    expect(id).toMatch(/^section-/);
  });
});

describe('Section type guards', () => {
  const createSection = (type: SectionType): ProjectSection => ({
    id: 'test',
    type,
    enabled: true,
    order: 0,
    content: createDefaultSectionContent(type),
  });

  it('isOverviewSection correctly identifies overview sections', () => {
    expect(isOverviewSection(createSection('overview'))).toBe(true);
    expect(isOverviewSection(createSection('features'))).toBe(false);
  });

  it('isFeaturesSection correctly identifies features sections', () => {
    expect(isFeaturesSection(createSection('features'))).toBe(true);
    expect(isFeaturesSection(createSection('overview'))).toBe(false);
  });

  it('isTechStackSection correctly identifies tech_stack sections', () => {
    expect(isTechStackSection(createSection('tech_stack'))).toBe(true);
    expect(isTechStackSection(createSection('features'))).toBe(false);
  });

  it('isGallerySection correctly identifies gallery sections', () => {
    expect(isGallerySection(createSection('gallery'))).toBe(true);
    expect(isGallerySection(createSection('demo'))).toBe(false);
  });

  it('isArchitectureSection correctly identifies architecture sections', () => {
    expect(isArchitectureSection(createSection('architecture'))).toBe(true);
    expect(isArchitectureSection(createSection('gallery'))).toBe(false);
  });

  it('isDemoSection correctly identifies demo sections', () => {
    expect(isDemoSection(createSection('demo'))).toBe(true);
    expect(isDemoSection(createSection('links'))).toBe(false);
  });

  it('isChallengesSection correctly identifies challenges sections', () => {
    expect(isChallengesSection(createSection('challenges'))).toBe(true);
    expect(isChallengesSection(createSection('demo'))).toBe(false);
  });

  it('isLinksSection correctly identifies links sections', () => {
    expect(isLinksSection(createSection('links'))).toBe(true);
    expect(isLinksSection(createSection('custom'))).toBe(false);
  });

  it('isCustomSection correctly identifies custom sections', () => {
    expect(isCustomSection(createSection('custom'))).toBe(true);
    expect(isCustomSection(createSection('overview'))).toBe(false);
  });
});

describe('DEFAULT_SECTION_ORDER', () => {
  it('contains all section types', () => {
    const sectionTypes: SectionType[] = [
      'overview',
      'features',
      'demo',
      'gallery',
      'tech_stack',
      'architecture',
      'challenges',
      'links',
      'custom',
    ];

    sectionTypes.forEach((type) => {
      expect(DEFAULT_SECTION_ORDER).toContain(type);
    });
  });

  it('has overview first', () => {
    expect(DEFAULT_SECTION_ORDER[0]).toBe('overview');
  });
});

describe('SECTION_METADATA', () => {
  it('has metadata for all section types', () => {
    const sectionTypes: SectionType[] = [
      'overview',
      'features',
      'tech_stack',
      'gallery',
      'architecture',
      'demo',
      'challenges',
      'links',
      'custom',
    ];

    sectionTypes.forEach((type) => {
      expect(SECTION_METADATA[type]).toBeDefined();
      expect(SECTION_METADATA[type].title).toBeDefined();
      expect(SECTION_METADATA[type].description).toBeDefined();
      expect(SECTION_METADATA[type].icon).toBeDefined();
      expect(typeof SECTION_METADATA[type].defaultEnabled).toBe('boolean');
    });
  });

  it('has overview enabled by default', () => {
    expect(SECTION_METADATA.overview.defaultEnabled).toBe(true);
  });

  it('has demo disabled by default', () => {
    expect(SECTION_METADATA.demo.defaultEnabled).toBe(false);
  });
});

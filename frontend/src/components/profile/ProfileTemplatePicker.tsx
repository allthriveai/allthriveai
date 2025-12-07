/**
 * ProfileTemplatePicker - Modal for selecting a profile template
 *
 * This component is shown when a user first customizes their profile
 * or wants to change their template. It displays all available templates
 * with descriptions and recommended use cases.
 */

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { ProfileTemplate } from '@/types/profileSections';
import { PROFILE_TEMPLATES } from '@/types/profileSections';

interface ProfileTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: ProfileTemplate) => void;
  currentTemplate?: ProfileTemplate;
  recommendedTemplate?: ProfileTemplate;
}

// Icons for each template
const templateIcons: Record<ProfileTemplate, React.ReactNode> = {
  explorer: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  builder: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  creator: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  curation: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  battle_bot: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

// Color schemes for each template
const templateColors: Record<ProfileTemplate, { bg: string; border: string; text: string; icon: string }> = {
  explorer: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500',
  },
  builder: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    icon: 'text-purple-500',
  },
  creator: {
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    border: 'border-pink-200 dark:border-pink-800',
    text: 'text-pink-700 dark:text-pink-300',
    icon: 'text-pink-500',
  },
  curation: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-700 dark:text-teal-300',
    icon: 'text-teal-500',
  },
  battle_bot: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: 'text-yellow-500',
  },
};

export function ProfileTemplatePicker({
  isOpen,
  onClose,
  onSelect,
  currentTemplate,
  recommendedTemplate,
}: ProfileTemplatePickerProps) {
  // Filter out system-only templates (curation and battle_bot are auto-assigned by backend)
  const USER_SELECTABLE_TEMPLATES: ProfileTemplate[] = ['explorer', 'builder', 'creator'];

  const templates = (Object.entries(PROFILE_TEMPLATES) as [ProfileTemplate, typeof PROFILE_TEMPLATES[ProfileTemplate]][])
    .filter(([key]) => USER_SELECTABLE_TEMPLATES.includes(key));

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                      Choose Your Profile Template
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Select a template that best describes your journey
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Templates Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map(([key, template]) => {
                      const isSelected = currentTemplate === key;
                      const isRecommended = recommendedTemplate === key;
                      const colors = templateColors[key];

                      return (
                        <button
                          key={key}
                          onClick={() => onSelect(key)}
                          className={`relative p-5 text-left rounded-xl border-2 transition-all ${
                            isSelected
                              ? `${colors.bg} ${colors.border} ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-800`
                              : `border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50`
                          }`}
                        >
                          {/* Recommended Badge */}
                          {isRecommended && !isSelected && (
                            <span className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-primary-500 to-cyan-500 text-white rounded-full shadow-md">
                              <SparklesIcon className="w-3 h-3" />
                              Recommended
                            </span>
                          )}

                          {/* Selected Checkmark */}
                          {isSelected && (
                            <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-md">
                              <CheckIcon className="w-4 h-4" />
                            </span>
                          )}

                          <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={`flex-shrink-0 p-3 rounded-lg ${colors.bg} ${colors.icon}`}>
                              {templateIcons[key]}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold text-lg mb-1 ${isSelected ? colors.text : 'text-gray-900 dark:text-white'}`}>
                                {template.name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                {template.description}
                              </p>

                              {/* Default Sections */}
                              <div className="flex flex-wrap gap-1.5">
                                {template.defaultSections.map((section) => (
                                  <span
                                    key={section}
                                    className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                  >
                                    {section.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      You can change your template anytime and customize sections freely.
                    </p>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

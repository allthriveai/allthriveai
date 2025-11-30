import { Fragment, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';

export type IntegrationType = 'github' | 'youtube' | 'upload' | 'url';

interface ChatPlusMenuProps {
  onIntegrationSelect: (type: IntegrationType) => void;
  disabled?: boolean;
}

interface IntegrationOption {
  type: IntegrationType;
  label: string;
  icon: string;
  description: string;
  available: boolean;
}

const integrationOptions: IntegrationOption[] = [
  {
    type: 'github',
    label: 'Add from GitHub',
    icon: '🐙',
    description: 'Import a repository',
    available: true,
  },
  {
    type: 'youtube',
    label: 'Add from YouTube',
    icon: '📺',
    description: 'Import a video',
    available: true,
  },
  {
    type: 'upload',
    label: 'Upload File',
    icon: '📁',
    description: 'Upload files or images',
    available: true,
  },
  {
    type: 'url',
    label: 'Paste URL',
    icon: '🔗',
    description: 'Import from any URL',
    available: true,
  },
];

const comingSoonIntegrations = [
  { label: 'Midjourney', icon: '🎨' },
  { label: 'Replit', icon: '⚡' },
  { label: 'Figma', icon: '🎨' },
  { label: 'Dribbble', icon: '🏀' },
];

export function ChatPlusMenu({ onIntegrationSelect, disabled = false }: ChatPlusMenuProps) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button
        disabled={disabled}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Add integration"
      >
        <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute left-0 bottom-full mb-2 w-64 origin-bottom-left bg-white dark:bg-slate-800 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="p-2">
            {/* Available integrations */}
            {integrationOptions.map((option) => (
              <Menu.Item key={option.type}>
                {({ active }) => (
                  <button
                    onClick={() => onIntegrationSelect(option.type)}
                    className={`
                      w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors
                      ${active ? 'bg-slate-100 dark:bg-slate-700' : ''}
                    `}
                  >
                    <span className="text-2xl flex-shrink-0">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {option.label}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {option.description}
                      </div>
                    </div>
                  </button>
                )}
              </Menu.Item>
            ))}

            {/* Divider */}
            <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

            {/* Coming soon section */}
            <div className="px-3 py-2">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                More integrations coming soon
              </div>
              <div className="flex flex-wrap gap-2">
                {comingSoonIntegrations.map((integration) => (
                  <div
                    key={integration.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 opacity-50"
                  >
                    <span className="text-sm">{integration.icon}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {integration.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

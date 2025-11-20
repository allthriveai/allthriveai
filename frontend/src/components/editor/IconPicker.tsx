import { useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import * as FaIcons from 'react-icons/fa';
import * as HiIcons from 'react-icons/hi2';

// Popular icons for quick access
const POPULAR_ICONS = [
  'FaDownload', 'FaExternalLinkAlt', 'FaPlayCircle', 'FaFileDownload', 'FaFilePdf',
  'FaFileWord', 'FaFileExcel', 'FaFileCode', 'FaGithub', 'FaLinkedin',
  'FaTwitter', 'FaEnvelope', 'FaPhone', 'FaMapMarkerAlt', 'FaGlobe',
  'FaRocket', 'FaStar', 'FaHeart', 'FaCheck', 'FaArrowRight',
  'FaInfoCircle', 'FaQuestionCircle', 'FaExclamationCircle', 'FaLightbulb', 'FaCog',
];

interface IconPickerProps {
  selectedIcon?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function IconPicker({ selectedIcon, onSelect, onClose }: IconPickerProps) {
  const [search, setSearch] = useState('');

  // Get all FontAwesome icons
  const allIcons = Object.keys(FaIcons).filter(key => key.startsWith('Fa'));

  // Filter icons based on search
  const filteredIcons = search
    ? allIcons.filter(icon => icon.toLowerCase().includes(search.toLowerCase()))
    : POPULAR_ICONS;

  const renderIcon = (iconName: string) => {
    const Icon = (FaIcons as any)[iconName];
    if (!Icon) return null;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Choose an Icon</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {!search && (
            <p className="text-xs text-gray-500 mt-2">Showing popular icons. Search to see all {allIcons.length} icons.</p>
          )}
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
            {filteredIcons.map((iconName) => (
              <button
                key={iconName}
                onClick={() => {
                  onSelect(iconName);
                  onClose();
                }}
                className={`p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center ${
                  selectedIcon === iconName
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
                title={iconName}
              >
                {renderIcon(iconName)}
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No icons found matching "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              onSelect('');
              onClose();
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Remove icon
          </button>
        </div>
      </div>
    </div>
  );
}

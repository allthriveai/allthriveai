import React, { useState } from 'react';
import { FolderIcon, DocumentIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface DirectoryTreeProps {
  tree: TreeNode;
}

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
}

function TreeNodeComponent({ node, depth }: TreeNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const isDirectory = node.type === 'directory';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
          isDirectory && hasChildren ? 'cursor-pointer' : ''
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => {
          if (isDirectory && hasChildren) {
            setCollapsed(!collapsed);
          }
        }}
      >
        {isDirectory && hasChildren && (
          <div className="w-4 h-4 flex-shrink-0">
            {collapsed ? (
              <ChevronRightIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </div>
        )}
        {(!isDirectory || !hasChildren) && <div className="w-4" />}
        {isDirectory ? (
          <FolderIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        ) : (
          <DocumentIcon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        )}
        <span className="text-sm text-gray-900 dark:text-gray-100 font-mono truncate">{node.name}</span>
      </div>

      {isDirectory && hasChildren && !collapsed && (
        <div>
          {node.children?.map((child, index) => (
            <TreeNodeComponent key={`${child.name}-${index}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DirectoryTree({ tree }: DirectoryTreeProps) {
  if (!tree || !tree.children || tree.children.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
        <p className="text-gray-500 dark:text-gray-400 text-sm">No directory structure available</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="overflow-x-auto">
        {tree.children.map((child, index) => (
          <TreeNodeComponent key={`${child.name}-${index}`} node={child} depth={0} />
        ))}
      </div>
    </div>
  );
}

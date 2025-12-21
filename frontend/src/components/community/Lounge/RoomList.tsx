/**
 * Room List Component
 *
 * Displays list of available rooms in the sidebar.
 * Shows online count and last activity.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComments, faRobot, faBook, faPalette, faHand, faUsers } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { RoomListItem, RoomListProps } from '@/types/community';
import { formatDistanceToNow } from 'date-fns';

// Map icon names to FontAwesome icon definitions
const iconMap: Record<string, IconDefinition> = {
  'comments': faComments,
  'robot': faRobot,
  'book': faBook,
  'palette': faPalette,
  'hand': faHand,
  'users': faUsers,
};

function getIcon(iconName: string): IconDefinition {
  return iconMap[iconName] || faComments;
}

export function RoomList({ rooms, selectedRoomId, onRoomSelect }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="p-4 text-center text-slate-400">
        <p>No rooms available</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {rooms.map((room) => (
        <RoomListItem
          key={room.id}
          room={room}
          isSelected={room.id === selectedRoomId}
          onSelect={() => onRoomSelect(room.id)}
        />
      ))}
    </div>
  );
}

interface RoomListItemProps {
  room: RoomListItem;
  isSelected: boolean;
  onSelect: () => void;
}

function RoomListItem({ room, isSelected, onSelect }: RoomListItemProps) {
  const lastActivity = room.lastMessageAt
    ? formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true })
    : 'No messages yet';

  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 text-left transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-l-2 border-cyan-400'
          : 'hover:bg-white/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Room Icon */}
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
          <FontAwesomeIcon icon={getIcon(room.icon)} className="text-cyan-400" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Room Name */}
          <div className="flex items-center gap-2">
            <h3 className={`font-medium truncate ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
              {room.name}
            </h3>
            {room.isDefault && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                Default
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-slate-400 truncate mt-0.5">{room.description}</p>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            {/* Online Count */}
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 luminous-dot"></span>
              {room.onlineCount} online
            </span>

            {/* Last Activity */}
            <span>{lastActivity}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default RoomList;

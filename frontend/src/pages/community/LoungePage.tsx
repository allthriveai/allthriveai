/**
 * The Lounge - Community Forums Page
 *
 * Displays list of forum rooms with real-time room view.
 * Uses Neon Glass design system.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRooms } from '@/services/community';
import { RoomList } from '@/components/community/Lounge/RoomList';
import { RoomView } from '@/components/community/Room/RoomView';
import type { RoomListItem } from '@/types/community';

export function LoungePage() {
  const { roomId } = useParams<{ roomId?: string }>();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load rooms on mount
  useEffect(() => {
    async function loadRooms() {
      try {
        setLoading(true);
        const roomList = await getRooms('forum');
        setRooms(roomList);

        // If no room selected, navigate to default or first room
        if (!roomId && roomList.length > 0) {
          const defaultRoom = roomList.find((r) => r.isDefault) || roomList[0];
          navigate(`/lounge/${defaultRoom.id}`, { replace: true });
        }
      } catch (_err) {
        setError('Failed to load rooms');
      } finally {
        setLoading(false);
      }
    }

    loadRooms();
  }, [roomId, navigate]);

  const handleRoomSelect = (id: string) => {
    navigate(`/lounge/${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-panel p-8">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-cyan-500/30"></div>
            <span className="text-slate-400">Loading The Lounge...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-panel p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar - Room List */}
      <aside className="w-72 flex-shrink-0 border-r border-white/10 glass-panel rounded-none">
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🛋️</span>
            The Lounge
          </h1>
          <p className="text-sm text-slate-400 mt-1">Community forums</p>
        </div>
        <RoomList
          rooms={rooms}
          selectedRoomId={roomId}
          onRoomSelect={handleRoomSelect}
        />
      </aside>

      {/* Main Content - Room View */}
      <main className="flex-1 flex flex-col">
        {roomId ? (
          <RoomView roomId={roomId} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <span className="text-4xl mb-4 block">👋</span>
              <p>Select a room to start chatting</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default LoungePage;

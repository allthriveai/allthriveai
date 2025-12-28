/**
 * The Lounge - Community Forums Page
 *
 * Displays list of forum rooms with real-time room view.
 * Uses Neon Glass design system.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCouch, faHand } from '@fortawesome/free-solid-svg-icons';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { getRooms } from '@/services/community';
import { RoomList } from '@/components/community/Lounge/RoomList';
import { RoomView } from '@/components/community/Room/RoomView';
import type { RoomListItem } from '@/types/community';

export function LoungePage() {
  const { roomSlug } = useParams<{ roomSlug?: string }>();
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
        if (!roomSlug && roomList.length > 0) {
          const defaultRoom = roomList.find((r) => r.isDefault) || roomList[0];
          navigate(`/lounge/${defaultRoom.slug}`, { replace: true });
        }
      } catch (_err) {
        setError('Failed to load rooms');
      } finally {
        setLoading(false);
      }
    }

    loadRooms();
  }, [roomSlug, navigate]);

  // Look up room ID from slug for WebSocket connection
  const selectedRoom = rooms.find((r) => r.slug === roomSlug);
  const selectedRoomId = selectedRoom?.id;

  const handleRoomSelect = (slug: string) => {
    navigate(`/lounge/${slug}`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        {() => (
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <div className="glass-panel p-8">
              <div className="animate-pulse flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-500/30"></div>
                <span className="text-slate-400">Loading The Lounge...</span>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        {() => (
          <div className="flex items-center justify-center h-full min-h-[60vh]">
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
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {() => (
        <div className="h-[calc(100vh-8rem)] flex overflow-hidden mt-2">
          {/* Sidebar - Room List */}
          <aside className="w-72 flex-shrink-0 border-r border-white/10 glass-panel rounded-none">
            <div className="p-6 border-b border-white/10">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faCouch} className="text-cyan-400" />
                The Lounge
              </h1>
              <p className="text-sm text-slate-400 mt-1">Community forums</p>
            </div>
            <RoomList
              rooms={rooms}
              selectedRoomSlug={roomSlug}
              onRoomSelect={handleRoomSelect}
            />
          </aside>

          {/* Main Content - Room View */}
          <main className="flex-1 flex flex-col">
            {selectedRoomId ? (
              <RoomView roomId={selectedRoomId} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <FontAwesomeIcon icon={faHand} className="text-4xl mb-4 text-cyan-400" />
                  <p>Select a room to start chatting</p>
                </div>
              </div>
            )}
          </main>
        </div>
      )}
    </DashboardLayout>
  );
}

export default LoungePage;

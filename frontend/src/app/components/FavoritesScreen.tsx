import { MapPin, Clock, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface Room {
  id: string;
  building: string;
  roomNumber: string;
  floor: number;
  availableFor: number | null;
  nextClass: string | null;
  type: string;
}

interface FavoritesScreenProps {
  favorites: string[];
  onRoomSelect: (room: Room) => void;
  isDesktop: boolean;
  rooms?: Room[];
}

const mockRooms: Room[] = [
  {
    id: '1',
    building: 'North Building',
    roomNumber: 'N402',
    floor: 4,
    availableFor: 125,
    nextClass: '3:00 PM',
    type: 'Classroom',
  },
  {
    id: '2',
    building: 'North Building',
    roomNumber: 'N305',
    floor: 3,
    availableFor: 45,
    nextClass: '2:00 PM',
    type: 'Lecture Hall',
  },
  {
    id: '3',
    building: 'West Building',
    roomNumber: 'W621',
    floor: 6,
    availableFor: 210,
    nextClass: '4:30 PM',
    type: 'Classroom',
  },
  {
    id: '4',
    building: 'North Building',
    roomNumber: 'N208',
    floor: 2,
    availableFor: 90,
    nextClass: '2:45 PM',
    type: 'Computer Lab',
  },
  {
    id: '5',
    building: 'East Building',
    roomNumber: 'E512',
    floor: 5,
    availableFor: 180,
    nextClass: '4:15 PM',
    type: 'Classroom',
  },
  {
    id: '6',
    building: 'Thomas Hunter Hall',
    roomNumber: 'TH304',
    floor: 3,
    availableFor: 65,
    nextClass: '2:20 PM',
    type: 'Lecture Hall',
  },
];

function formatAvailability(minutes: number | null): string {
  if (minutes === null) return 'All day';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// add a room to favorites
const addFavorite = (roomId: string): void => {
  const stored = localStorage.getItem('favoriteRooms');
  const favorites: string[] = stored ? JSON.parse(stored) : [];
  if (!favorites.includes(roomId)) {
    favorites.push(roomId);
    localStorage.setItem('favoriteRooms', JSON.stringify(favorites));
  }
};

// remove a room from favorites
const removeFavorite = (roomId: string): void => {
  const stored = localStorage.getItem('favoriteRooms');
  const favorites: string[] = stored ? JSON.parse(stored) : [];
  const updated = favorites.filter(id => id !== roomId);
  localStorage.setItem('favoriteRooms', JSON.stringify(updated));
};

// get all favorites
const getFavorites = (): string[] => {
  const stored = localStorage.getItem('favoriteRooms');
  return stored ? JSON.parse(stored) : [];
};

export function FavoritesScreen({ favorites, onRoomSelect, isDesktop, rooms = mockRooms }: FavoritesScreenProps) {
  const favoriteRooms = rooms.filter((room) => favorites.includes(room.id));
  console.log('Favorite Rooms:', favoriteRooms);

  return (
    <div className={`min-h-full ${isDesktop ? 'px-12 py-10' : 'px-6 py-6'}`}>
      <div className={isDesktop ? 'max-w-6xl mx-auto' : 'max-w-md mx-auto'}>
        {/* Header */}
        <div className={isDesktop ? 'mb-8' : 'mb-6'}>
          <h2 className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>Favorite Rooms</h2>
          <p className={`${isDesktop ? 'text-base' : 'text-sm'} text-muted-foreground`}>
            {favoriteRooms.length > 0
              ? `${favoriteRooms.length} saved room${favoriteRooms.length > 1 ? 's' : ''}`
              : 'No saved rooms yet'}
          </p>
        </div>

        {/* Empty State */}
        {favoriteRooms.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg mb-2 text-foreground">No favorites yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Save your frequently used study rooms for quick access
            </p>
          </div>
        )}

        {/* Favorites List */}
        {favoriteRooms.length > 0 && (
          <div className={isDesktop ? 'grid grid-cols-2 gap-4' : 'space-y-3'}>
            {favoriteRooms.map((room, index) => (
              <motion.button
                key={room.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onRoomSelect(room)}
                className="w-full bg-white border border-border rounded-2xl p-4 hover:border-[#2563eb]/40 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Room Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        {room.building}
                      </span>
                    </div>

                    <div className="text-xl mb-1.5 text-foreground">
                      Room {room.roomNumber}
                    </div>

                    <div className="text-sm text-muted-foreground mb-3">
                      Floor {room.floor} · {room.type}
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {room.nextClass ? `Next class at ${room.nextClass}` : 'No more classes today'}
                      </span>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="bg-[#10b981] text-white px-4 py-2.5 rounded-xl text-center min-w-[80px]">
                      {room.availableFor === null ? (
                        <div className="text-lg leading-none py-1">All day</div>
                      ) : (
                        <>
                          <div className="text-2xl leading-none mb-0.5">
                            {formatAvailability(room.availableFor).split(' ')[0]}
                          </div>
                          <div className="text-xs opacity-90">
                            {formatAvailability(room.availableFor).split(' ')[1] || 'available'}
                          </div>
                        </>
                      )}
                    </div>

                    <Heart className="w-5 h-5 text-[#ef4444] fill-[#ef4444]" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

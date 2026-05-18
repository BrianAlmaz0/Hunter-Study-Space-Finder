import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { DetailScreen } from './components/DetailScreen';
import { FavoritesScreen } from './components/FavoritesScreen';
import { Home, Search, Heart, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Screen = 'home' | 'results' | 'detail' | 'favorites';

interface SearchFilters {
  building?: string;
  roomType?: string;
  day: string;
  time: string;
}

interface Room {
  id: string;
  building: string;
  roomNumber: string;
  floor: number;
  availableFor: number;
  nextClass: string;
  type: string;
  capacity?: number;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('favoriteRooms');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    }
  }, []);

  // Map backend room data to frontend Room interface
  const mapBackendRoom = (backendRoom: any): Room => ({
    id: backendRoom._id || backendRoom.id,
    building: backendRoom.building,
    roomNumber: backendRoom.room_number,
    floor: backendRoom.floor,
    availableFor: backendRoom.availableFor || 120, // Default availability
    nextClass: backendRoom.nextClass || 'Not scheduled',
    type: backendRoom.room_type || 'room',
    capacity: backendRoom.capacity,
  });

  // calculate next class and availability for a room based on a given day and time
  const calculateNextClassAndAvailability = (classes: any[], searchDay: string, searchTime: string): { nextClass: string; availableFor: number } => {
    const currentMinutes = parseInt(searchTime.split(':')[0]) * 60 + parseInt(searchTime.split(':')[1]);
    
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayIndex = daysOfWeek.indexOf(searchDay);

    let nextClass: any = null;
    let minTimeDiff = Infinity;

    // check all classes and find the next one
    classes.forEach((cls: any) => {
      cls.days.forEach((dayName: string) => {
        const dayIndex = daysOfWeek.indexOf(dayName);
        const [startHour, startMin] = cls.startTime.split(':').map(Number);
        const classMinutes = startHour * 60 + startMin;

        let timeDiff = 0;
        let isToday = false;

        if (dayIndex === currentDayIndex) {
          // same day - check if it's in the future
          timeDiff = classMinutes - currentMinutes;
          isToday = true;
        } else if (dayIndex > currentDayIndex) {
          // later this week
          const daysUntil = dayIndex - currentDayIndex;
          timeDiff = daysUntil * 1440 + (classMinutes - currentMinutes); // 1440 min per day
        } else {
          // next week
          const daysUntil = (7 - currentDayIndex) + dayIndex;
          timeDiff = daysUntil * 1440 + (classMinutes - currentMinutes);
        }

        // Find the nearest future class
        if (timeDiff > 0 && timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          nextClass = { ...cls, dayName, timeDiffMinutes: timeDiff, isToday };
        }
      });
    });

    const nextClassDisplay = nextClass
      ? nextClass.isToday
        ? new Date(`2000-01-01 ${nextClass.startTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        : `${nextClass.dayName} ${new Date(`2000-01-01 ${nextClass.startTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : 'Not scheduled';

    const availableFor = nextClass?.timeDiffMinutes || 120;

    return { nextClass: nextClassDisplay, availableFor };
  };

  // get all rooms for favorites display/results screen on initial load
  useEffect(() => {
    const fetchAllRooms = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/rooms');
        if (!response.ok) throw new Error('Failed to fetch rooms');
        const rooms = await response.json();
        const mappedRooms = rooms.map(mapBackendRoom);
        setAllRooms(mappedRooms);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };

    const fetchCurrentAvailableRooms = async () => {
      try {
        const now = new Date();
        const day = now.toLocaleString('en-US', { weekday: 'long' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const params = new URLSearchParams({ day, time });
        const response = await fetch(`http://localhost:5000/api/available-rooms?${params}`);
        
        if (!response.ok) throw new Error('Failed to fetch available rooms');
        const rooms = await response.json();
        const mappedRooms = rooms.map(mapBackendRoom);

        // get classes for each room to calculate availability and next class
        const results = await Promise.all(
          mappedRooms.map(async (room : Room) => {
            try {
              const classRes = await fetch(`http://localhost:5000/api/rooms/${room.id}/classes`);
              if (!classRes.ok) throw new Error('Failed to fetch classes');
              const classes = await classRes.json();
              const { nextClass, availableFor } = calculateNextClassAndAvailability(classes, day, time);
              return { ...room, nextClass, availableFor };
            } catch (error) {
              console.error(`Error fetching classes for room ${room.id}:`, error);
              return room;
            }
          })
        );
        
        setSearchResults(results);
      } catch (error) {
        console.error('Error fetching current available rooms:', error);
      }
    };

    fetchAllRooms();
    fetchCurrentAvailableRooms();
  }, []);

  const handleSearch = async (filters: SearchFilters) => {
    try {
      const params = new URLSearchParams({
        day: filters.day,
        time: filters.time,
      });
      if (filters.building) {
        params.append('building', filters.building);
      }
      if (filters.roomType) {
        params.append('room_type', filters.roomType);
      }

      const response = await fetch(`http://localhost:5000/api/filter-rooms?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }
      const results = await response.json();
      const mappedResults = results.map(mapBackendRoom);
      
      const data = await Promise.all(
        mappedResults.map(async (room : Room) => {
          try {
            // get classes for a specific room for availability calculation
            const classRes = await fetch(`http://localhost:5000/api/rooms/${room.id}/classes`);
            if (!classRes.ok) throw new Error('Failed to fetch classes');
            const classes = await classRes.json();
            const { nextClass, availableFor } = calculateNextClassAndAvailability(classes, filters.day, filters.time);
            return { ...room, nextClass, availableFor };
          } catch (error) {
            console.error(`Error fetching classes for room ${room.id}:`, error);
            return room;
          }
        })
      );
      
      setSearchResults(data);
      setCurrentScreen('results');
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentScreen('detail');
  };

  const handleBack = () => {
    if (currentScreen === 'detail') {
      setCurrentScreen('results');
    }
  };

  const toggleFavorite = (roomId: string) => {
    setFavorites(prev => {
      const isFav = prev.includes(roomId);
      const updated = isFav
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId];
      // add to local storage
      localStorage.setItem('favoriteRooms', JSON.stringify(updated));
      return updated;
    });
  };

  const isFavorite = (roomId: string) => favorites.includes(roomId);

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="size-full bg-[#fafbfc] flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-border flex flex-col">
          <div className="p-6 border-b border-border">
            <h1 className="text-xl text-foreground">Hunter Study Space</h1>
            <p className="text-sm text-muted-foreground mt-1">Find study rooms</p>
          </div>

          <nav className="flex-1 p-4">
            <button
              onClick={() => setCurrentScreen('home')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
                currentScreen === 'home'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Search</span>
            </button>

            <button
              onClick={() => setCurrentScreen('results')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${
                currentScreen === 'results'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Search className="w-5 h-5" />
              <span>Results</span>
            </button>

            <button
              onClick={() => setCurrentScreen('favorites')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentScreen === 'favorites'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
            </button>
          </nav>

          <div className="p-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              <div className="mb-2">24 rooms available now</div>
              <div>Hunter College</div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {currentScreen === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <HomeScreen onSearch={handleSearch} isDesktop={true} />
              </motion.div>
            )}

            {currentScreen === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ResultsScreen
                  onRoomSelect={handleRoomSelect}
                  favorites={favorites}
                  isDesktop={true}
                  rooms={searchResults}
                />
              </motion.div>
            )}

            {currentScreen === 'detail' && selectedRoom && (
              <motion.div
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-white border-b border-border px-8 py-4 flex items-center gap-3">
                  <button
                    onClick={handleBack}
                    className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl">Room Details</h2>
                </div>
                <DetailScreen
                  room={selectedRoom}
                  isFavorite={isFavorite(selectedRoom.id)}
                  onToggleFavorite={() => toggleFavorite(selectedRoom.id)}
                  isDesktop={true}
                />
              </motion.div>
            )}

            {currentScreen === 'favorites' && (
              <motion.div
                key="favorites"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FavoritesScreen
                  favorites={favorites}
                  onRoomSelect={handleRoomSelect}
                  isDesktop={true}
                  rooms={allRooms}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="size-full bg-[#fafbfc] flex flex-col">
      {/* Header with back button */}
      {currentScreen === 'detail' && (
        <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg">Room Details</h3>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {currentScreen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <HomeScreen onSearch={handleSearch} isDesktop={false} />
            </motion.div>
          )}

          {currentScreen === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ResultsScreen
                onRoomSelect={handleRoomSelect}
                favorites={favorites}
                isDesktop={false}
                rooms={searchResults}
              />
            </motion.div>
          )}

          {currentScreen === 'detail' && selectedRoom && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DetailScreen
                room={selectedRoom}
                isFavorite={isFavorite(selectedRoom.id)}
                onToggleFavorite={() => toggleFavorite(selectedRoom.id)}
                isDesktop={false}
              />
            </motion.div>
          )}

          {currentScreen === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <FavoritesScreen
                favorites={favorites}
                onRoomSelect={handleRoomSelect}
                isDesktop={false}
                rooms={allRooms}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {currentScreen !== 'detail' && (
        <div className="bg-white border-t border-border px-6 py-3 safe-area-inset-bottom">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                currentScreen === 'home'
                  ? 'text-[#2563eb]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs">Home</span>
            </button>

            <button
              onClick={() => setCurrentScreen('results')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                currentScreen === 'results'
                  ? 'text-[#2563eb]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs">Search</span>
            </button>

            <button
              onClick={() => setCurrentScreen('favorites')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                currentScreen === 'favorites'
                  ? 'text-[#2563eb]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Heart className="w-6 h-6" />
              <span className="text-xs">Favorites</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

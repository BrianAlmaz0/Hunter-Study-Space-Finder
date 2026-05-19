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
  day: string;
  time: string;
}

interface Room {
  id: string;
  building: string;
  roomNumber: string;
  floor: number;
  availableFor: number | null;
  nextClass: string | null;
  type: string;
  capacity?: number;
}

const API = 'http://localhost:3001';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchFilters, setLastSearchFilters] = useState<SearchFilters>(() => {
    const now = new Date();
    return {
      day:  now.toLocaleString('en-US', { weekday: 'long' }),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };
  });

  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 1024);
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('favoriteRooms');
    if (stored) {
      try { setFavorites(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Fetch buildings list and all rooms for the favorites screen on mount
  useEffect(() => {
    fetch(`${API}/api/rooms/buildings`)
      .then(r => r.json())
      .then(setBuildings)
      .catch(() => { /* keep default list in HomeScreen */ });

    fetch(`${API}/api/rooms/all`)
      .then(r => r.json())
      .then(setAllRooms)
      .catch(() => { /* favorites may be empty */ });

    // Pre-populate results with currently available rooms
    const now = new Date();
    const day  = now.toLocaleString('en-US', { weekday: 'long' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    fetch(`${API}/api/rooms/available?day=${encodeURIComponent(day)}&time=${encodeURIComponent(time)}`)
      .then(r => r.json())
      .then(setSearchResults)
      .catch(() => { /* leave empty */ });
  }, []);

  const handleSearch = async (filters: SearchFilters) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ day: filters.day, time: filters.time });
      if (filters.building) params.append('building', filters.building);

      const response = await fetch(`${API}/api/rooms/available?${params}`);
      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const results: Room[] = await response.json();
      setSearchResults(results);
      setLastSearchFilters(filters);
      setCurrentScreen('results');
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not reach server');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentScreen('detail');
  };

  const handleBack = () => {
    if (currentScreen === 'detail') setCurrentScreen('results');
  };

  const toggleFavorite = (roomId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId];
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
              <div className="mb-2">{searchResults.length} rooms available</div>
              <div>Hunter College</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {currentScreen === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <HomeScreen
                  onSearch={handleSearch}
                  isDesktop={true}
                  buildings={buildings}
                  isSearching={isSearching}
                  searchError={searchError}
                />
              </motion.div>
            )}
            {currentScreen === 'results' && (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <ResultsScreen onRoomSelect={handleRoomSelect} favorites={favorites} isDesktop={true} rooms={searchResults} />
              </motion.div>
            )}
            {currentScreen === 'detail' && selectedRoom && (
              <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="bg-white border-b border-border px-8 py-4 flex items-center gap-3">
                  <button onClick={handleBack} className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl">Room Details</h2>
                </div>
                <DetailScreen
                  room={selectedRoom}
                  isFavorite={isFavorite(selectedRoom.id)}
                  onToggleFavorite={() => toggleFavorite(selectedRoom.id)}
                  isDesktop={true}
                  searchDay={lastSearchFilters.day}
                  searchTime={lastSearchFilters.time}
                />
              </motion.div>
            )}
            {currentScreen === 'favorites' && (
              <motion.div key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <FavoritesScreen favorites={favorites} onRoomSelect={handleRoomSelect} isDesktop={true} rooms={allRooms} />
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
      {currentScreen === 'detail' && (
        <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg">Room Details</h3>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {currentScreen === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <HomeScreen
                onSearch={handleSearch}
                isDesktop={false}
                buildings={buildings}
                isSearching={isSearching}
                searchError={searchError}
              />
            </motion.div>
          )}
          {currentScreen === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <ResultsScreen onRoomSelect={handleRoomSelect} favorites={favorites} isDesktop={false} rooms={searchResults} />
            </motion.div>
          )}
          {currentScreen === 'detail' && selectedRoom && (
            <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <DetailScreen
                room={selectedRoom}
                isFavorite={isFavorite(selectedRoom.id)}
                onToggleFavorite={() => toggleFavorite(selectedRoom.id)}
                isDesktop={false}
                searchDay={lastSearchFilters.day}
                searchTime={lastSearchFilters.time}
              />
            </motion.div>
          )}
          {currentScreen === 'favorites' && (
            <motion.div key="favorites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <FavoritesScreen favorites={favorites} onRoomSelect={handleRoomSelect} isDesktop={false} rooms={allRooms} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentScreen !== 'detail' && (
        <div className="bg-white border-t border-border px-6 py-3 safe-area-inset-bottom">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button
              onClick={() => setCurrentScreen('home')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'home' ? 'text-[#2563eb]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs">Home</span>
            </button>
            <button
              onClick={() => setCurrentScreen('results')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'results' ? 'text-[#2563eb]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Search className="w-6 h-6" />
              <span className="text-xs">Search</span>
            </button>
            <button
              onClick={() => setCurrentScreen('favorites')}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'favorites' ? 'text-[#2563eb]' : 'text-muted-foreground hover:text-foreground'}`}
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

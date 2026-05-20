import { useState, useEffect } from 'react';
import { HomeScreen } from './HomeScreen';
import { ResultsScreen } from './ResultsScreen';
import { DetailScreen } from './DetailScreen';
import { FavoritesScreen } from './FavoritesScreen';
import { LoginScreen } from './LoginScreen';
import { Home, Search, Heart, ChevronLeft, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Screen = 'home' | 'results' | 'detail' | 'favorites';

interface SearchFilters {
  building?: string;
  roomType?: string;
  floor?: string;
  day: string;
  time: string;
}

interface Room {
  id: string;
  building: string;
  roomNumber: string;
  floor: string | number;
  availableFor: number | null;
  nextClass: string | null;
  type: string;
  capacity?: number;
}

interface StudentUser {
  name: string;
  emplid: string;
}

const API = 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState<StudentUser | null>(() => {
    const saved = localStorage.getItem('student_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchResults, setSearchResults] = useState<Room[]>([]);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    day: new Date().toLocaleString('en-US', { weekday: 'long' }),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  });

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchInitialData = async () => {
      try {
        const res = await fetch(`${API}/api/rooms-metadata`);
        if (res.ok) {
          const data = await res.json();
          setBuildings(data.buildings || []);
        }
      } catch (err) {
        console.error('Failed to pull baseline metadata:', err);
      }
    };
    fetchInitialData();
  }, [user]);

  const handleLoginSuccess = (studentData: StudentUser) => {
    localStorage.setItem('student_session', JSON.stringify(studentData));
    setUser(studentData);
  };

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    setUser(null);
    setCurrentScreen('home');
    setSelectedRoom(null);
  };

  const handleSearchSubmit = async (filters: SearchFilters) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchFilters(filters);

    try {
      const params = new URLSearchParams({
        day: filters.day,
        time: filters.time,
        ...(filters.building && { building: filters.building }),
        ...(filters.roomType && filters.roomType !== 'all' && { room_type: filters.roomType }),
        ...(filters.floor && { floor: filters.floor }),
      });

      const res = await fetch(`${API}/api/filter-rooms?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to retrieve search results.');
      
      const data = await res.json();
      setSearchResults(data);
      setCurrentScreen('results');
    } catch (err: any) {
      setSearchError(err.message || 'Network connection failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentScreen('detail');
  };

  const toggleFavorite = (roomId: string) => {
    setFavorites(prev => 
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  };

  // If user session does not exist, block everything else and render the login view
  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} isDesktop={isDesktop} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto border-x border-border relative pb-16 shadow-md">
      {/* Platform Header */}
      <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {currentScreen === 'detail' && (
            <button 
              onClick={() => setCurrentScreen('results')}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {currentScreen === 'home' && 'Find a Space'}
              {currentScreen === 'results' && 'Available Rooms'}
              {currentScreen === 'detail' && selectedRoom?.roomNumber}
              {currentScreen === 'favorites' && 'Your Saved Spaces'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Welcome back, {user.name}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="p-2 hover:bg-destructive/10 rounded-xl text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Screen Routing Content Container */}
      <main className="flex-1 w-full bg-accent/20">
        <AnimatePresence mode="wait">
          {currentScreen === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <HomeScreen 
                onSearch={handleSearchSubmit} 
                isDesktop={isDesktop}
                buildings={buildings}
                isSearching={isSearching}
                searchError={searchError}
              />
            </motion.div>
          )}

          {currentScreen === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsScreen 
                rooms={searchResults}
                favorites={favorites}
                onRoomSelect={handleRoomSelect}
                isDesktop={isDesktop}
              />
            </motion.div>
          )}

          {currentScreen === 'detail' && selectedRoom && (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DetailScreen 
                room={selectedRoom}
                isFavorite={favorites.includes(selectedRoom.id)}
                onToggleFavorite={() => toggleFavorite(selectedRoom.id)}
                isDesktop={isDesktop}
                searchDay={searchFilters.day}
                searchTime={searchFilters.time}
              />
            </motion.div>
          )}

          {currentScreen === 'favorites' && (
            <motion.div
              key="favorites"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <FavoritesScreen 
                favorites={favorites}
                rooms={searchResults}
                onRoomSelect={handleRoomSelect}
                isDesktop={isDesktop}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Base Navigation Dock */}
      {currentScreen !== 'detail' && (
        <div className="bg-white border-t border-border px-6 py-3 fixed bottom-0 max-w-md w-full z-40 safe-area-inset-bottom">
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

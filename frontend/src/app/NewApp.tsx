import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { DetailScreen } from './components/DetailScreen';
import { FavoritesScreen } from './components/FavoritesScreen';
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
  floor: number;
  availableFor: number | null;
  nextClass: string | null;
  type: string;
  capacity?: number;
}

interface StudentUser {
  name: string;
  email: string;
}

const API = 'http://localhost:3001';

export default function App() {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);

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
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) { setIsVerifying(false); return; }

      try {
        const res = await fetch(`${API}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.student);
          localStorage.setItem('student_session', JSON.stringify(data.student));
        } else {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('student_session');
        }
      } catch {
        const cached = localStorage.getItem('student_session');
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch { }
        }
      } finally {
        setIsVerifying(false);
      }
    };
    verifySession();
  }, []);

  useEffect(() => {
    if (!user) { setFavorites([]); return; }
    const token = localStorage.getItem('auth_token');
    Promise.all([
      fetch(`${API}/api/rooms/buildings`).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/rooms/all`).then(r => r.json()).catch(() => []),
      token
        ? fetch(`${API}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]).then(([buildingList, roomList, favoritesList]) => {
      setBuildings(buildingList);
      setAllRooms(roomList);
      if (Array.isArray(favoritesList)) setFavorites(favoritesList);
    });
  }, [user]);

  const handleLoginSuccess = (studentData: StudentUser, token: string) => {
    localStorage.setItem('student_session', JSON.stringify(studentData));
    localStorage.setItem('auth_token', token);
    setUser(studentData);
  };

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    localStorage.removeItem('auth_token');
    setUser(null);
    setFavorites([]);
    setCurrentScreen('home');
    setSelectedRoom(null);
  };

  const handleSearchSubmit = async (filters: SearchFilters) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchFilters(filters);

    try {
      const params = new URLSearchParams({ day: filters.day, time: filters.time });
      if (filters.building) params.append('building', filters.building);
      if (filters.floor) params.append('floor', filters.floor);

      const res = await fetch(`${API}/api/rooms/available?${params.toString()}`);
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
    const token = localStorage.getItem('auth_token');
    const removing = favorites.includes(roomId);

    setFavorites(prev => removing ? prev.filter(id => id !== roomId) : [...prev, roomId]);

    if (!token) return;
    if (removing) {
      fetch(`${API}/api/favorites/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } else {
      fetch(`${API}/api/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId }),
      }).catch(() => {});
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-accent/30">
        <div className="text-muted-foreground text-sm">Verifying session...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} isDesktop={isDesktop} />;
  }

  const screens = (
    <AnimatePresence mode="wait">
      {currentScreen === 'home' && (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <HomeScreen onSearch={handleSearchSubmit} isDesktop={isDesktop} buildings={buildings} isSearching={isSearching} searchError={searchError} />
        </motion.div>
      )}
      {currentScreen === 'results' && (
        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ResultsScreen rooms={searchResults} favorites={favorites} onRoomSelect={handleRoomSelect} isDesktop={isDesktop} />
        </motion.div>
      )}
      {currentScreen === 'detail' && selectedRoom && (
        <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DetailScreen room={selectedRoom} isFavorite={favorites.includes(selectedRoom.id)} onToggleFavorite={() => toggleFavorite(selectedRoom.id)} isDesktop={isDesktop} searchDay={searchFilters.day} searchTime={searchFilters.time} />
        </motion.div>
      )}
      {currentScreen === 'favorites' && (
        <motion.div key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FavoritesScreen favorites={favorites} rooms={allRooms} onRoomSelect={handleRoomSelect} isDesktop={isDesktop} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (isDesktop) {
    return (
      <div className="size-full bg-background flex">
        <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
          <div className="p-6 border-b border-sidebar-border">
            <h1 className="text-xl text-sidebar-foreground">Hunter Study Space</h1>
            <p className="text-sm text-muted-foreground mt-1">Find study rooms</p>
          </div>

          <nav className="flex-1 p-4">
            <button onClick={() => setCurrentScreen('home')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${currentScreen === 'home' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
              <Home className="w-5 h-5" /><span>Search</span>
            </button>
            <button onClick={() => setCurrentScreen('results')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-2 ${currentScreen === 'results' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
              <Search className="w-5 h-5" /><span>Results</span>
            </button>
            <button onClick={() => setCurrentScreen('favorites')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentScreen === 'favorites' ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
              <Heart className="w-5 h-5" /><span>Favorites</span>
            </button>
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="text-xs text-muted-foreground mb-3">
              <div className="mb-1">{searchResults.length} rooms available</div>
              <div>Welcome, {user.name}</div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="w-4 h-4" /><span>Sign Out</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {currentScreen === 'detail' && (
            <div className="bg-card border-b border-border px-8 py-4 flex items-center gap-3">
              <button onClick={() => setCurrentScreen('results')} className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl text-card-foreground">Room Details</h2>
            </div>
          )}
          {screens}
        </div>
      </div>
    );
  }

  return (
    <div className="size-full bg-background flex flex-col">
      {currentScreen === 'detail' && (
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setCurrentScreen('results')} className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg text-card-foreground">Room Details</h3>
        </div>
      )}

      <div className="flex-1 overflow-auto">{screens}</div>

      {currentScreen !== 'detail' && (
        <div className="bg-card border-t border-border px-6 py-3 safe-area-inset-bottom">
          <div className="flex items-center justify-around max-w-md mx-auto">
            <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'home' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Home className="w-6 h-6" /><span className="text-xs">Home</span>
            </button>
            <button onClick={() => setCurrentScreen('results')} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'results' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Search className="w-6 h-6" /><span className="text-xs">Search</span>
            </button>
            <button onClick={() => setCurrentScreen('favorites')} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${currentScreen === 'favorites' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Heart className="w-6 h-6" /><span className="text-xs">Favorites</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

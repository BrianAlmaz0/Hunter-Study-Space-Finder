import { useState, useEffect } from 'react';
import { HomeScreen } from './components/HomeScreen';
import { ResultsScreen } from './components/ResultsScreen';
import { DetailScreen } from './components/DetailScreen';
import { FavoritesScreen } from './components/FavoritesScreen';
import { Home, Search, Heart, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Screen = 'home' | 'results' | 'detail' | 'favorites';

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

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const handleSearch = () => {
    setCurrentScreen('results');
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
    setFavorites(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
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

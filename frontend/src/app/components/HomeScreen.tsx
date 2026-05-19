import { useState } from 'react';
import { MapPin, Clock, Grid3x3 } from 'lucide-react';

interface HomeScreenProps {
  onSearch: (filters: SearchFilters) => void;
  isDesktop: boolean;
  buildings?: string[];
  isSearching?: boolean;
  searchError?: string | null;
}

interface SearchFilters {
  building?: string;
  roomType?: string;
  day: string;
  time: string;
}

const DEFAULT_BUILDINGS = [
  'North Building',
  'West Building',
  'East Building',
  'Thomas Hunter Hall',
  'Baker Building',
  'Silberman',
  'Roosevelt House',
];

export function HomeScreen({ onSearch, isDesktop, buildings, isSearching = false, searchError = null }: HomeScreenProps) {
  const [building, setBuilding] = useState('');
  const [timeFilter, setTimeFilter] = useState('now');
  const [roomType, setRoomType] = useState('all');
  const [selectedDay, setSelectedDay] = useState(new Date().toLocaleString('en-US', { weekday: 'long' }));
  const [selectedTime, setSelectedTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));

  const buildingList = (buildings && buildings.length > 0) ? buildings : DEFAULT_BUILDINGS;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleSearch = () => {
    const filters: SearchFilters = {
      day:  timeFilter === 'now'
        ? new Date().toLocaleString('en-US', { weekday: 'long' })
        : selectedDay,
      time: timeFilter === 'now'
        ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : selectedTime,
    };
    if (building) filters.building = building;
    onSearch(filters);
  };

  return (
    <div className={`min-h-full ${isDesktop ? 'px-12 py-12' : 'px-6 py-8'}`}>
      <div className={isDesktop ? 'max-w-2xl mx-auto' : 'max-w-md mx-auto'}>
        {/* Header */}
        <div className={isDesktop ? 'mb-16' : 'mb-12'}>
          <h1 className={`${isDesktop ? 'text-4xl' : 'text-3xl'} mb-2 text-foreground`}>
            {isDesktop ? 'Find Your Study Space' : 'Hunter Study Space Finder'}
          </h1>
          <p className={`text-muted-foreground ${isDesktop ? 'text-lg' : ''}`}>
            Find available classrooms to study between classes
          </p>
        </div>

        {/* Search Filters */}
        <div className={isDesktop ? 'space-y-6' : 'space-y-5'}>
          {/* Building Selection */}
          <div>
            <label className="flex items-center gap-2 mb-3 text-sm text-foreground">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Building
            </label>
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-border rounded-xl appearance-none cursor-pointer hover:border-[#2563eb]/50 transition-colors"
            >
              <option value="">Select a building</option>
              {buildingList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          <div>
            <label className="flex items-center gap-2 mb-3 text-sm text-foreground">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Time
            </label>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setTimeFilter('now')}
                className={`flex-1 px-4 py-3.5 rounded-xl transition-all ${
                  timeFilter === 'now'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white border border-border hover:border-[#2563eb]/50'
                }`}
              >
                Now
              </button>
              <button
                onClick={() => setTimeFilter('custom')}
                className={`flex-1 px-4 py-3.5 rounded-xl transition-all ${
                  timeFilter === 'custom'
                    ? 'bg-[#2563eb] text-white'
                    : 'bg-white border border-border hover:border-[#2563eb]/50'
                }`}
              >
                Custom Time
              </button>
            </div>

            {/* Custom Time Form */}
            {timeFilter === 'custom' && (
              <div className="bg-white border border-border rounded-xl p-4 space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">Day</label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-lg appearance-none cursor-pointer hover:border-[#2563eb]/50 transition-colors text-sm"
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-2">Time</label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-border rounded-lg hover:border-[#2563eb]/50 transition-colors text-sm"
                  />
                </div>
              </div>
            )}

          </div>

          {/* Room Type Filter */}
          <div>
            <label className="flex items-center gap-2 mb-3 text-sm text-foreground">
              <Grid3x3 className="w-4 h-4 text-muted-foreground" />
              Room Type
            </label>
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-border rounded-xl appearance-none cursor-pointer hover:border-[#2563eb]/50 transition-colors"
            >
              <option value="all">All Rooms</option>
              <option value="Classroom">Classroom</option>
              <option value="Lecture Hall">Lecture Hall</option>
              <option value="Computer Lab">Computer Lab</option>
            </select>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full mt-8 px-6 py-4 bg-[#2563eb] text-white rounded-xl hover:bg-[#1d4ed8] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSearching ? 'Searching...' : 'Search Available Rooms'}
        </button>

        {searchError && (
          <p className="mt-3 text-sm text-red-500 text-center">{searchError}</p>
        )}

        {/* Quick Stats */}
        <div className={`${isDesktop ? 'mt-16 pt-12' : 'mt-12 pt-8'} border-t border-border`}>
          <div className={`grid grid-cols-3 ${isDesktop ? 'gap-8' : 'gap-4'} text-center`}>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>24</div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>Available Now</div>
            </div>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>6</div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>Buildings</div>
            </div>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>150+</div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>Total Rooms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

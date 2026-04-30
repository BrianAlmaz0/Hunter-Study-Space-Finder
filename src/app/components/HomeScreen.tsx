import { useState } from 'react';
import { MapPin, Clock, Grid3x3 } from 'lucide-react';

interface HomeScreenProps {
  onSearch: () => void;
  isDesktop: boolean;
}

export function HomeScreen({ onSearch, isDesktop }: HomeScreenProps) {
  const [building, setBuilding] = useState('');
  const [timeFilter, setTimeFilter] = useState('now');
  const [roomType, setRoomType] = useState('all');

  const buildings = [
    'North Building',
    'West Building',
    'East Building',
    'Hunter West',
    'Hunter North',
    'Thomas Hunter Hall',
  ];

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
              {buildings.map((b) => (
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
            <div className="flex gap-3">
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
              <option value="classroom">Classroom</option>
              <option value="lecture">Lecture Hall</option>
              <option value="lab">Computer Lab</option>
            </select>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={onSearch}
          className="w-full mt-8 px-6 py-4 bg-[#2563eb] text-white rounded-xl hover:bg-[#1d4ed8] transition-colors shadow-sm"
        >
          Search Available Rooms
        </button>

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

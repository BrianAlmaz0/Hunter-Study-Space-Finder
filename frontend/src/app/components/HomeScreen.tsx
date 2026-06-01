import { useState } from 'react';
import { MapPin, Clock, Grid3x3 } from 'lucide-react';

interface HomeScreenProps {
  onSearch: (filters: SearchFilters) => void;
  isDesktop: boolean;
  buildings?: string[];
  buildingFloors?: Record<string, string[]>;
  isSearching?: boolean;
  searchError?: string | null;
  availableNowCount?: number;
  buildingCount?: number;
  totalRoomsCount?: number;
}

interface SearchFilters {
  building?: string;
  floor?: string;
  day: string;
  time: string;
  date: string;
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

export function HomeScreen({
  onSearch,
  isDesktop,
  buildings,
  buildingFloors = {},
  isSearching = false,
  searchError = null,
  availableNowCount,
  buildingCount,
  totalRoomsCount,
}: HomeScreenProps) {
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [timeFilter, setTimeFilter] = useState('now');

  // Reset floor whenever building changes so stale selections don't carry over.
  const handleBuildingChange = (newBuilding: string) => {
    setBuilding(newBuilding);
    setFloor('');
  };

  // Floors available for the currently selected building (already sorted: C first, then numeric).
  const availableFloors: string[] = building ? (buildingFloors[building] ?? []) : [];
  const [selectedDay, setSelectedDay] = useState(
    new Date().toLocaleString('en-US', { weekday: 'long' })
  );
  const [selectedTime, setSelectedTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  const buildingList = buildings && buildings.length > 0 ? buildings : DEFAULT_BUILDINGS;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Returns YYYY-MM-DD for the next (or current) occurrence of a day name from today.
  const nextOccurrenceOf = (dayName: string): string => {
    const order = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const target = order.indexOf(dayName);
    const now    = new Date();
    let ahead    = target - now.getDay();
    if (ahead < 0) ahead += 7;
    const d = new Date(now);
    d.setDate(now.getDate() + ahead);
    return d.toISOString().split('T')[0];
  };

  const todayStr = (): string => new Date().toISOString().split('T')[0];

  const handleSearch = () => {
    const isNow = timeFilter === 'now';
    const now   = new Date();
    const filters: SearchFilters = {
      day:  isNow ? now.toLocaleString('en-US', { weekday: 'long' }) : selectedDay,
      time: isNow ? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : selectedTime,
      date: isNow ? todayStr() : nextOccurrenceOf(selectedDay),
    };
    if (building) filters.building = building;
    if (floor) filters.floor = floor;
    onSearch(filters);
  };

  const statAvailable  = availableNowCount  != null ? String(availableNowCount)  : '—';
  const statBuildings  = buildingCount      != null ? String(buildingCount)       : String(buildingList.length);
  const statTotalRooms = totalRoomsCount    != null ? String(totalRoomsCount)     : '—';

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
          <p className="text-xs text-muted-foreground mt-1">
            Accurate for Summer 2026 semester.
          </p>
        </div>

        {/* Search Filters */}
        <div className={isDesktop ? 'space-y-6' : 'space-y-5'}>

          {/* Building */}
          <div>
            <label className="flex items-center gap-2 mb-3 text-sm text-foreground">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Building
            </label>
            <select
              value={building}
              onChange={(e) => handleBuildingChange(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-border rounded-xl appearance-none cursor-pointer hover:border-[#2563eb]/50 transition-colors"
            >
              <option value="">All Buildings</option>
              {buildingList.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Floor — only shown when a specific building is selected */}
          {building && availableFloors.length > 0 && (
            <div>
              <label className="flex items-center gap-2 mb-3 text-sm text-foreground">
                <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                Floor
              </label>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-border rounded-xl appearance-none cursor-pointer hover:border-[#2563eb]/50 transition-colors"
              >
                <option value="">All Floors</option>
                {availableFloors.map(f => (
                  <option key={f} value={f}>Floor {f}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                Some floors may not appear because they primarily contain faculty offices or non-classroom facilities.
              </p>
            </div>
          )}

          {/* Time */}
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
                      <option key={day} value={day}>{day}</option>
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

        {/* Live Stats */}
        <div className={`${isDesktop ? 'mt-16 pt-12' : 'mt-12 pt-8'} border-t border-border`}>
          <div className={`grid grid-cols-3 ${isDesktop ? 'gap-8' : 'gap-4'} text-center`}>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>
                {statAvailable}
              </div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
                Available Now
              </div>
            </div>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>
                {statBuildings}
              </div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
                Buildings
              </div>
            </div>
            <div>
              <div className={`${isDesktop ? 'text-3xl' : 'text-2xl'} mb-1 text-foreground`}>
                {statTotalRooms}
              </div>
              <div className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground`}>
                Tracked Rooms
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

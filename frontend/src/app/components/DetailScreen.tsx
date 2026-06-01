import { useState, useEffect } from 'react';
import { MapPin, Layers, Grid3x3, Clock, Users, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { API } from '../api';

interface Room {
  id: string;
  building: string;
  roomNumber: string;
  floor: number | string;
  availableFor: number | null;
  nextClass: string | null;
  type: string;
  capacity?: number;
  studentOccupancyCount?: number;
}

interface UpcomingClass {
  courseTopic: string;
  subjectCode: string;
  section: string;
  instructor: string[];
  startTime: string;
  endTime: string;
  isCurrent: boolean;
}

interface OccupancyReport {
  room: string;
  building: string | null;
  expiresAt: string;
  createdAt: string;
}

interface DetailScreenProps {
  room: Room;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isDesktop: boolean;
  searchDay: string;
  searchTime: string;
  searchDate?: string;
  isAuthenticated: boolean;
  onOccupancyChange?: (occupancy: OccupancyReport | null) => void;
  activeRoom?: string | null;
}

function formatAvailability(minutes: number | null): string {
  if (minutes === null) return 'Rest of day';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  return mins > 0
    ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes`
    : `${hours} hour${hours > 1 ? 's' : ''}`;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function DetailScreen({
  room, isFavorite, onToggleFavorite, isDesktop, searchDay, searchTime, searchDate, isAuthenticated, onOccupancyChange, activeRoom,
}: DetailScreenProps) {
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const [occupancyCount, setOccupancyCount]   = useState<number>(room.studentOccupancyCount ?? 0);
  const [myReport, setMyReport]               = useState<{ expiresAt: string } | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [confirmingSwitch, setConfirmingSwitch] = useState<'1hour' | '2hours' | 'next_class' | null>(null);

  // Fetch schedule
  useEffect(() => {
    const date   = searchDate || new Date().toISOString().split('T')[0];
    const params = new URLSearchParams({ room: room.id, day: searchDay, time: searchTime, date });
    fetch(`${API}/api/rooms/schedule?${params}`)
      .then(r => r.json())
      .then(data => { setUpcomingClasses(data); setLoadingSchedule(false); })
      .catch(() => setLoadingSchedule(false));
  }, [room.id, searchDay, searchTime, searchDate]);

  // Fetch live occupancy (+ check if this user already has a report)
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/occupancy/${encodeURIComponent(room.id)}`, { headers })
      .then(r => r.json())
      .then(data => {
        setOccupancyCount(data.count ?? 0);
        setMyReport(data.myReport ?? null);
      })
      .catch(() => {});
  }, [room.id]);

  const reportOccupancy = async (duration: '1hour' | '2hours' | 'next_class') => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/occupancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room: room.id, building: room.building, duration }),
      });
      if (res.ok) {
        const data = await res.json();
        // Only bump the count if this is a brand-new report (not an update)
        if (!myReport) setOccupancyCount(c => c + 1);
        setMyReport({ expiresAt: data.expiresAt });
        onOccupancyChange?.({
          room: room.id,
          building: room.building,
          expiresAt: data.expiresAt,
          createdAt: new Date().toISOString(),
        });
      }
    } catch { /* ignore network errors */ }
    setSubmitting(false);
  };

  const clearOccupancy = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/occupancy/${encodeURIComponent(room.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMyReport(null);
        setOccupancyCount(c => Math.max(0, c - 1));
        onOccupancyChange?.(null);
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  return (
    <div className={`min-h-full ${isDesktop ? 'px-12 py-10' : 'px-6 py-6'}`}>
      <div className={isDesktop ? 'max-w-4xl mx-auto' : 'max-w-md mx-auto'}>

        {/* Room Header */}
        <div className={isDesktop ? 'mb-8' : 'mb-6'}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className={`${isDesktop ? 'text-4xl' : 'text-3xl'} mb-2 text-foreground`}>
                Room {room.roomNumber}
              </h1>
              <div className={`flex items-center gap-2 text-muted-foreground ${isDesktop ? 'text-lg' : ''}`}>
                <MapPin className={isDesktop ? 'w-5 h-5' : 'w-4 h-4'} />
                <span>{room.building}</span>
              </div>
            </div>
            <button
              onClick={onToggleFavorite}
              className="p-3 rounded-xl border border-border hover:border-[#ef4444]/50 hover:bg-accent transition-all"
            >
              <Heart
                className={`${isDesktop ? 'w-7 h-7' : 'w-6 h-6'} ${
                  isFavorite ? 'text-[#ef4444] fill-[#ef4444]' : 'text-muted-foreground'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className={isDesktop ? 'grid grid-cols-2 gap-8' : ''}>

          {/* Left column */}
          <div>
            {/* Availability card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`bg-gradient-to-br from-[#10b981] to-[#059669] text-white rounded-2xl ${isDesktop ? 'p-8' : 'p-6'} mb-6 shadow-sm`}
            >
              <div className={`${isDesktop ? 'text-base' : 'text-sm'} opacity-90 mb-2`}>Available for</div>
              <div className={isDesktop ? 'text-5xl mb-6' : 'text-4xl mb-4'}>
                {formatAvailability(room.availableFor)}
              </div>
              <div className={`flex items-center gap-2 ${isDesktop ? 'text-base' : 'text-sm'} opacity-90`}>
                <Clock className={isDesktop ? 'w-5 h-5' : 'w-4 h-4'} />
                <span>
                  {room.nextClass ? `Next class starts at ${room.nextClass}` : 'No more classes today'}
                </span>
              </div>
            </motion.div>

            {/* Student occupancy banner */}
            {occupancyCount > 0 && (
              <div className={`flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl ${isDesktop ? 'p-4 mb-6' : 'p-3 mb-5'}`}>
                <Users className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <div className="text-sm text-amber-800">
                    {occupancyCount === 1 ? '1 student currently here' : `${occupancyCount} students currently here`}
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">Student-reported occupancy</div>
                </div>
              </div>
            )}

            {/* Room detail chips */}
            <div className={`${isDesktop ? 'space-y-4' : 'space-y-3'} mb-6`}>
              <div className={`bg-white border border-border rounded-xl ${isDesktop ? 'p-5' : 'p-4'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isDesktop ? 'w-12 h-12' : 'w-10 h-10'} bg-accent rounded-lg flex items-center justify-center`}>
                    <Layers className={`${isDesktop ? 'w-6 h-6' : 'w-5 h-5'} text-muted-foreground`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-0.5">Floor</div>
                    <div className={`text-foreground ${isDesktop ? 'text-lg' : ''}`}>{room.floor}</div>
                  </div>
                </div>
              </div>

              <div className={`bg-white border border-border rounded-xl ${isDesktop ? 'p-5' : 'p-4'}`}>
                <div className="flex items-center gap-3">
                  <div className={`${isDesktop ? 'w-12 h-12' : 'w-10 h-10'} bg-accent rounded-lg flex items-center justify-center`}>
                    <Grid3x3 className={`${isDesktop ? 'w-6 h-6' : 'w-5 h-5'} text-muted-foreground`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-0.5">Room Type</div>
                    <div className={`text-foreground ${isDesktop ? 'text-lg' : ''}`}>{room.type}</div>
                  </div>
                </div>
              </div>

              {room.capacity && (
                <div className={`bg-white border border-border rounded-xl ${isDesktop ? 'p-5' : 'p-4'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`${isDesktop ? 'w-12 h-12' : 'w-10 h-10'} bg-accent rounded-lg flex items-center justify-center`}>
                      <Users className={`${isDesktop ? 'w-6 h-6' : 'w-5 h-5'} text-muted-foreground`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-0.5">Capacity</div>
                      <div className={`text-foreground ${isDesktop ? 'text-lg' : ''}`}>{room.capacity} students</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Occupancy reporting (logged-in users only) */}
            {isAuthenticated && (
              <div className={`bg-white border border-border rounded-xl ${isDesktop ? 'p-5 mb-6' : 'p-4 mb-5'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">Are you studying here?</span>
                </div>

                {confirmingSwitch ? (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                      <p className="text-xs text-amber-800">
                        You're currently marked in <strong>{activeRoom?.split(' ').pop()}</strong>. To mark this room, you'll need to leave that room first.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await reportOccupancy(confirmingSwitch);
                          setConfirmingSwitch(null);
                        }}
                        disabled={submitting}
                        className="flex-1 px-3 py-2.5 text-xs bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                      >
                        Leave & Mark Here
                      </button>
                      <button
                        onClick={() => setConfirmingSwitch(null)}
                        disabled={submitting}
                        className="flex-1 px-3 py-2.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : myReport ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      You're reported here until {formatExpiry(myReport.expiresAt)}.
                    </p>
                    <button
                      onClick={clearOccupancy}
                      disabled={submitting}
                      className="w-full px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      I Left
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { label: '1 Hour',           value: '1hour'      },
                        { label: '2 Hours',          value: '2hours'     },
                        { label: 'Until Next Class', value: 'next_class' },
                      ] as const
                    ).map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => {
                          if (activeRoom && activeRoom !== room.id) {
                            setConfirmingSwitch(value);
                          } else {
                            reportOccupancy(value);
                          }
                        }}
                        disabled={submitting}
                        className="px-2 py-2.5 text-xs bg-accent rounded-lg hover:bg-[#2563eb] hover:text-white transition-colors disabled:opacity-50"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — schedule */}
          <div>
            <h3 className={`${isDesktop ? 'text-2xl' : 'text-lg'} ${isDesktop ? 'mb-4' : 'mb-3'} text-foreground`}>
              Upcoming Schedule
            </h3>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {loadingSchedule ? (
                <div className="p-4 text-sm text-muted-foreground">Loading schedule...</div>
              ) : upcomingClasses.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No more classes today</div>
              ) : (
                upcomingClasses.map((cls, i) => (
                  <div
                    key={i}
                    className={`${isDesktop ? 'p-5' : 'p-4'} ${i < upcomingClasses.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`${isDesktop ? 'text-base' : 'text-sm'} text-foreground`}>
                        {cls.startTime} – {cls.endTime}
                      </span>
                      {cls.isCurrent && (
                        <span className={`${isDesktop ? 'text-sm' : 'text-xs'} text-white bg-[#ef4444] px-2 py-1 rounded`}>
                          Now
                        </span>
                      )}
                      {i === 0 && !cls.isCurrent && (
                        <span className={`${isDesktop ? 'text-sm' : 'text-xs'} text-muted-foreground bg-accent px-2 py-1 rounded`}>
                          Next
                        </span>
                      )}
                    </div>
                    <div className={`${isDesktop ? 'text-base' : 'text-sm'} text-muted-foreground`}>
                      {cls.courseTopic}
                    </div>
                    {cls.instructor?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {cls.instructor.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

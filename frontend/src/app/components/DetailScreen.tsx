import { useState, useEffect } from 'react';
import { MapPin, Layers, Grid3x3, Clock, Users, Heart } from 'lucide-react';
import { motion } from 'motion/react';

const API = 'http://localhost:3001';

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

interface UpcomingClass {
  courseTopic: string;
  subjectCode: string;
  section: string;
  instructor: string[];
  startTime: string;
  endTime: string;
  isCurrent: boolean;
}

interface DetailScreenProps {
  room: Room;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isDesktop: boolean;
  searchDay: string;
  searchTime: string;
}

function formatAvailability(minutes: number | null): string {
  if (minutes === null) return 'Rest of day';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes` : `${hours} hour${hours > 1 ? 's' : ''}`;
}

export function DetailScreen({ room, isFavorite, onToggleFavorite, isDesktop, searchDay, searchTime }: DetailScreenProps) {
  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ room: room.id, day: searchDay, time: searchTime });
    fetch(`${API}/api/rooms/schedule?${params}`)
      .then(r => r.json())
      .then(data => { setUpcomingClasses(data); setLoadingSchedule(false); })
      .catch(() => setLoadingSchedule(false));
  }, [room.id, searchDay, searchTime]);

  console.log('Upcoming classes for room', room.id, upcomingClasses);

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

        {/* Main Content Grid */}
        <div className={isDesktop ? 'grid grid-cols-2 gap-8' : ''}>
          {/* Left Column */}
          <div>
            {/* Availability Status */}
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
                <span>{room.nextClass ? `Next class starts at ${room.nextClass}` : 'No more classes today'}</span>
              </div>
            </motion.div>

            {/* Room Details */}
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
          </div>

          {/* Right Column - Upcoming Schedule */}
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
                      <div className="text-xs text-muted-foreground mt-0.5">{cls.instructor.join(', ')}</div>
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

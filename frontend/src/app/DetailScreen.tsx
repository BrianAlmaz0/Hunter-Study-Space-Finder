import { useState, useEffect } from 'react';
import { Users, BookOpen, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { API } from './api';

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

interface DetailScreenProps {
  room: Room;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isDesktop: boolean;
  searchDay: string;
  searchTime: string;
}

interface OccupancyData {
  totalStudents: number;
  subjectsStudied: Record<string, number>;
}

export function DetailScreen({ room, isDesktop }: DetailScreenProps) {
  const [occupancy, setOccupancy] = useState<OccupancyData>({ totalStudents: 0, subjectsStudied: {} });
  const [subjectInput, setSubjectInput] = useState('');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchLiveOccupancy = async () => {
      try {
        const res = await fetch(`${API}/api/rooms/${room.id}/occupancy`);
        if (res.ok) {
          const data = await res.json();
          setOccupancy({
            totalStudents: data.totalStudents,
            subjectsStudied: data.subjectsStudied
          });
        }
      } catch (err) {
        console.error('Error fetching live occupancy stats:', err);
      }
    };

    fetchLiveOccupancy();
    const interval = setInterval(fetchLiveOccupancy, 30000);
    return () => clearInterval(interval);
  }, [room.id, isCheckedIn]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectInput.trim()) return;

    setIsSubmitting(true);
    try {
      const sessionRaw = localStorage.getItem('student_session');
      const student = sessionRaw ? JSON.parse(sessionRaw) : { name: 'Anonymous', emplid: '00000000' };

      const res = await fetch(`${API}/api/rooms/${room.id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emplid: student.emplid,
          studentName: student.name,
          subject: subjectInput.trim().toUpperCase()
        })
      });

      if (res.ok) {
        setIsCheckedIn(true);
        setSubjectInput('');
      }
    } catch (err) {
      console.error('Failed checking into space:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-6 space-y-6 max-w-md mx-auto ${isDesktop ? 'max-w-xl' : ''}`}>
      
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-secondary text-primary rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Live Occupancy</h3>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {occupancy.totalStudents} {occupancy.totalStudents === 1 ? 'Student' : 'Students'} inside
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${occupancy.totalStudents > 0 ? 'bg-emerald-50 text-emerald-700 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
          {occupancy.totalStudents > 0 ? '• Active Vibe' : 'Empty'}
        </span>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Study Topics Right Now
        </h3>

        {Object.keys(occupancy.subjectsStudied).length === 0 ? (
          <p className="text-sm text-muted-foreground italic bg-muted/50 p-4 rounded-xl text-center border border-dashed">
            No study tracks declared yet. Be the first to check in below!
          </p>
        ) : (
          <div className="space-y-3.5">
            {Object.entries(occupancy.subjectsStudied).map(([subject, count]) => {
              const percentage = Math.round((count / occupancy.totalStudents) * 100);
              return (
                <div key={subject} className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground tracking-wide font-semibold">{subject}</span>
                    <span className="text-muted-foreground">{count} {count === 1 ? 'student' : 'students'} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="bg-primary h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        {isCheckedIn ? (
          <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold">You're checked in!</p>
              <p className="text-xs text-emerald-700/80 mt-0.5">Your status safely updates this room's visual charts for the next 2 hours.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCheckInSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Studying here? Share your course track
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  placeholder="e.g., CSCI 135, MATH 150, BIO"
                  className="flex-1 px-3.5 py-2.5 bg-input-background border border-transparent rounded-xl focus:outline-none focus:border-border text-sm transition-colors"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !subjectInput.trim()}
                  className="px-4 py-2.5 bg-primary hover:opacity-90 text-primary-foreground font-medium text-sm rounded-xl transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  Check In
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-500" />
              Check-ins auto-expire after 2 hours to keep metrics accurate.
            </p>
          </form>
        )}
      </div>

    </div>
  );
}

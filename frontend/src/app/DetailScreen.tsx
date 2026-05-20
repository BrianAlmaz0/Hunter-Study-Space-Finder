import { useState, useEffect } from 'react';
import { Users, BookOpen, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

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

  // Fetch the dynamic crowdsourced room data on component load
  useEffect(() => {
    const fetchLiveOccupancy = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/rooms/${room.id}/occupancy`);
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
    const interval = setInterval(fetchLiveOccupancy, 30000); // Re-poll every 30s
    return () => clearInterval(interval);
  }, [room.id, isCheckedIn]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectInput.trim()) return;

    setIsSubmitting(true);
    try {
      // Pull student credentials directly out of your active session storage
      const sessionRaw = localStorage.getItem('student_session');
      const student = sessionRaw ? JSON.parse(sessionRaw) : { name: 'Anonymous', emplid: '00000000' };

      const res = await fetch(`http://localhost:3001/api/rooms/${room.id}/checkin`, {
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
      
      {/* 1. Live Headcount Overview Card */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Live Occupancy</h3>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {occupancy.totalStudents} {occupancy.totalStudents === 1 ? 'Student' : 'Students'} inside
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${occupancy.totalStudents > 0 ? 'bg-emerald-50 text-emerald-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
          {occupancy.totalStudents > 0 ? '• Active Vibe' : 'Empty'}
        </span>
      </div>

      {/* 2. Subjects Breakdown Monitor Layout */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          Study Topics Right Now
        </h3>

        {Object.keys(occupancy.subjectsStudied).length === 0 ? (
          <p className="text-sm text-muted-foreground italic bg-slate-50/50 p-4 rounded-xl text-center border border-dashed">
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
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="bg-blue-600 h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Crowdsourcing Interactive Action Panel */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
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
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !subjectInput.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-sm"
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

import { useState } from 'react';
import { GraduationCap, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess: (studentData: { name: string; emplid: string }) => void;
  isDesktop: boolean;
}

export function LoginScreen({ onLoginSuccess, isDesktop }: LoginScreenProps) {
  const [emplid, setEmplid] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{8}$/.test(emplid)) {
      setError('Your CUNY EMPLID must be exactly 8 digits long.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emplid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate student ID.');
      }

      onLoginSuccess(data.student);
    } catch (err: any) {
      setError(err.message || 'Server connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-accent/30 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white w-full max-w-md rounded-2xl border border-border p-6 shadow-xl ${isDesktop ? 'p-8' : 'p-6'}`}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 bg-primary/5 rounded-full mb-3 text-[#2563eb]">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hunter Study Spaces
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Student Verification Gateway
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              CUNY EMPLID (8 Digits)
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={8}
                pattern="\d*"
                inputMode="numeric"
                value={emplid}
                onChange={(e) => setEmplid(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g., 23456789"
                className="w-full px-4 py-3 bg-input-background border border-transparent rounded-xl focus:outline-none focus:border-border transition-colors text-base"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              Your ID is securely cross-referenced to verify active student enrollment status.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-xl flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isLoading || emplid.length !== 8}
            className="w-full py-3.5 bg-[#2563eb] text-white font-medium rounded-xl hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isLoading ? 'Verifying Identity...' : 'Access Platform'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

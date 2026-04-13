import { Rocket, Activity, Clock, Building2, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';

export type View = 'start' | 'live' | 'fomo' | 'history' | 'exchanges';

interface BottomNavProps {
  active: View;
  onChange: (v: View) => void;
  botRunning: boolean;
}

const TABS: { id: View; label: string; icon: typeof Rocket }[] = [
  { id: 'start',     label: 'Start',   icon: Rocket    },
  { id: 'live',      label: 'Live',    icon: Activity  },
  { id: 'fomo',      label: 'FOMO',    icon: Flame     },
  { id: 'history',   label: 'Hist.',   icon: Clock     },
  { id: 'exchanges', label: 'Giełdy',  icon: Building2 },
];

export function BottomNav({ active, onChange, botRunning }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] flex safe-bottom">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        const showPulse = id === 'live' && botRunning;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all relative',
              isActive ? 'text-white' : 'text-[#8892a4] active:text-[#8899bb]'
            )}
          >
            {/* Active top indicator */}
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#00d4ff] rounded-full" />
            )}
            <div className="relative">
              <Icon
                size={21}
                strokeWidth={isActive ? 2.3 : 1.7}
                className={cn(id === 'fomo' && (isActive ? 'text-[#ff3355]' : 'text-[#6a3040]'))}
              />
              {showPulse && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-[#00d68f] rounded-full animate-pulse border border-[#070c1a]" />
              )}
            </div>
            <span className={cn(
              'text-[10px] font-medium',
              isActive ? 'text-white' : 'text-[#8892a4]'
            )}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

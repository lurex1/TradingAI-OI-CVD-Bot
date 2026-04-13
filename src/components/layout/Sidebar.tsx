import { Rocket, Activity, Clock, Building2, Zap, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { View } from './BottomNav';

interface SidebarProps {
  active: View;
  onChange: (v: View) => void;
  botRunning: boolean;
}

const TABS: { id: View; label: string; icon: typeof Rocket; accent?: string }[] = [
  { id: 'start',     label: 'Start',         icon: Rocket    },
  { id: 'live',      label: 'Live',          icon: Activity  },
  { id: 'fomo',      label: 'FOMO Scanner',  icon: Flame,    accent: '#ff3355' },
  { id: 'history',   label: 'Historia',      icon: Clock     },
  { id: 'exchanges', label: 'Giełdy',        icon: Building2 },
];

export function Sidebar({ active, onChange, botRunning }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[#070c1a] border-r border-[rgba(0,212,255,0.15)] min-h-screen sticky top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[rgba(0,212,255,0.15)]">
        <div className="w-8 h-8 rounded-xl bg-[#00d4ff]/12 border border-[#00d4ff]/25 flex items-center justify-center shrink-0">
          <Zap size={15} className="text-[#00d4ff]" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">TradingAI</div>
          <div className="text-[10px] text-[#8892a4]">Claude · OI/CVD</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {TABS.map(({ id, label, icon: Icon, accent }) => {
          const isActive = active === id;
          const showPulse = id === 'live' && botRunning;
          const iconColor = accent ? (isActive ? accent : accent + '55') : undefined;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left',
                isActive
                  ? 'bg-[#00d4ff]/10 text-white border border-[#00d4ff]/20'
                  : 'text-[#8892a4] hover:text-[#c0cce0] hover:bg-[#0d1526] border border-transparent'
              )}
            >
              <div className="relative shrink-0">
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.2 : 1.7}
                  style={iconColor ? { color: iconColor } : undefined}
                />
                {showPulse && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[#00d68f] rounded-full" />
                )}
              </div>
              <span className="flex-1">{label}</span>
              {showPulse && (
                <span className="text-[9px] font-bold text-[#00d68f] bg-[#00d68f]/10 px-1.5 py-0.5 rounded-md leading-none">
                  LIVE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-4 border-t border-[rgba(0,212,255,0.15)]">
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full shrink-0',
            botRunning ? 'bg-[#00d68f] animate-pulse' : 'bg-[#1a3050]'
          )} />
          <span className="text-[11px] text-[#8892a4]">
            {botRunning ? 'Bot aktywny' : 'Bot wyłączony'}
          </span>
        </div>
      </div>
    </aside>
  );
}

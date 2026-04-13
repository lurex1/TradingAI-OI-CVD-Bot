import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'outline';
  className?: string;
}

const variants = {
  default: 'bg-slate-700/50 text-slate-300',
  green: 'bg-green-400/10 text-green-400 border border-green-400/20',
  red: 'bg-red-400/10 text-red-400 border border-red-400/20',
  yellow: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20',
  blue: 'bg-blue-400/10 text-blue-400 border border-blue-400/20',
  purple: 'bg-purple-400/10 text-purple-400 border border-purple-400/20',
  outline: 'border border-[#1e2d45] text-slate-400',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}

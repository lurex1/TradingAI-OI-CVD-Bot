import { cn } from '../../lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <label className={cn('flex items-center gap-3 cursor-pointer', className)}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={cn(
          'w-10 h-6 rounded-full transition-colors duration-200',
          checked ? 'bg-blue-600' : 'bg-[#1e2d45]'
        )} />
        <div className={cn(
          'absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0'
        )} />
      </div>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </label>
  );
}

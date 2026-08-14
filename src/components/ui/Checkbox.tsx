import React from 'react';
import { cn } from '../../utils/cn';
import { Check } from 'lucide-react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            ref={ref}
            className="peer sr-only"
            {...props}
          />
          <div className={cn(
            "w-6 h-6 rounded border-2 border-[#333333] bg-[#252525] transition-all",
            "peer-checked:bg-[#D4A947] peer-checked:border-[#D4A947]",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4A947]/50",
            className
          )}>
            <Check className="w-4 h-4 text-[#0D0D0D] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
          </div>
        </div>
        {label && (
          <span className="text-[#F0EDE6] select-none text-sm font-medium">
            {label}
          </span>
        )}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

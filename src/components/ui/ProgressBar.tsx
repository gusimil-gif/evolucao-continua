import React from 'react';
import { cn } from '../../utils/cn';

interface ProgressBarProps {
  progress: number; // 0 to 100
  className?: string;
  height?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className, height = 'md' }) => {
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("w-full bg-[#252525] rounded-full overflow-hidden", heights[height], className)}>
      <div 
        className="bg-[#D4A947] h-full transition-all duration-500 ease-out rounded-full"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
};

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '', showText = true }) => {
  const settings = {
    sm: { container: 'w-10 h-10', text: 'text-sm', subtitle: 'text-[8px]' },
    md: { container: 'w-16 h-16', text: 'text-base', subtitle: 'text-[9px]' },
    lg: { container: 'w-28 h-28', text: 'text-lg', subtitle: 'text-[10px]' },
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-1 ${className}`}>
      <div className="relative flex items-center justify-center group cursor-pointer">
        {/* Glow Dourado de Fundo */}
        <div className={`absolute ${size === 'lg' ? 'w-36 h-36' : size === 'md' ? 'w-24 h-24' : 'w-14 h-14'} bg-[#D4A947] rounded-full blur-[25px] opacity-[0.12] group-hover:opacity-[0.25] transition-opacity duration-700`} />
        
        {/* Container Circular da Logo */}
        <div className={`relative z-10 ${settings.container} rounded-full overflow-hidden ring-2 ring-[#D4A947]/30 group-hover:ring-[#D4A947]/60 transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(212,169,71,0.4)]`}>
          <img 
            src="/logo-evolucao-continua.png" 
            alt="Método Evolução Contínua" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </div>

      {showText && (
        <div className="text-center mt-1">
          <h1 className={`${settings.text} font-black tracking-[0.15em] text-[#F0EDE6] leading-tight`}>
            EVOLUÇÃO <span className="text-[#D4A947]">CONTÍNUA</span>
          </h1>
        </div>
      )}
    </div>
  );
};

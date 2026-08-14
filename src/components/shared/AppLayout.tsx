import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, Dumbbell, LogOut, FileText, MessageCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../ui/Logo';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isTrainer = userData?.userType === 'trainer';

  const trainerLinks = [
    { to: '/trainer', label: 'Home', icon: LayoutDashboard },
    { to: '/trainer/clients', label: 'Alunos', icon: Users },
    { to: '/trainer/workouts', label: 'Planos', icon: FileText },
    { to: '/trainer/exercises', label: 'Exercícios', icon: Dumbbell },
  ];

  const clientLinks = [
    { to: '/client', label: 'Meu Treino', icon: LayoutDashboard },
    { to: '/client/progress', label: 'Evolução', icon: Dumbbell },
    { to: '/client/community', label: 'Comunidade', icon: MessageCircle },
  ];

  const links = isTrainer ? trainerLinks : clientLinks;

  return (
    <div className="flex h-screen bg-[#0D0D0D] overflow-hidden flex-col md:flex-row">
      
      {/* ============================================================ */}
      {/* 1. Header Mobile (Visível apenas em Celulares no Topo)       */}
      {/* ============================================================ */}
      <header 
        className="md:hidden flex items-end justify-between px-4 pb-3 bg-[#1A1A1A] border-b border-[#333333] z-40 shadow-sm"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', minHeight: '80px' }}
      >
        <div className="flex items-center gap-3">
          <Logo size="sm" showText={true} />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center text-[#F0EDE6] font-bold text-sm border border-[#333333]">
            {userData?.nome.charAt(0).toUpperCase()}
          </div>
          <button 
            onClick={handleLogout} 
            className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 active:bg-red-500/30 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. Sidebar Desktop (Oculta no Mobile)                        */}
      {/* ============================================================ */}
      <aside className="w-64 bg-[#1A1A1A] border-r border-[#333333] flex-col hidden md:flex h-full z-40">
        <div className="p-6 flex flex-col items-center border-b border-[#333333]/50">
          <Logo size="md" />
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#8A8A7A] mt-3">
            {isTrainer ? 'Área do Treinador' : 'Área do Aluno'}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/trainer' || link.to === '/client'}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                  ? 'bg-[#D4A947]/10 text-[#D4A947] font-medium border border-[#D4A947]/20' 
                  : 'text-[#8A8A7A] hover:bg-[#252525] hover:text-[#F0EDE6] border border-transparent'
                }`
              }
            >
              <link.icon size={20} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#333333]">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-[#252525] flex items-center justify-center text-[#F0EDE6] font-bold shadow-inner">
              {userData?.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-[#F0EDE6] truncate">{userData?.nome}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            Sair da Plataforma
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 3. Área Principal do Conteúdo                                  */}
      {/* ============================================================ */}
      {/* No mobile, adicionamos pb-20 (padding bottom) para o conteúdo não sumir atrás da Bottom Nav */}
      <main className="flex-1 overflow-y-auto bg-[#0D0D0D] animate-in fade-in zoom-in-95 duration-300 relative z-10 w-full">
        <div className="h-full w-full pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {/* ============================================================ */}
      {/* 4. Bottom Tab Bar (Visível apenas no Mobile)                   */}
      {/* ============================================================ */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 w-full bg-[#1A1A1A]/95 backdrop-blur-md border-t border-[#333333] z-50 px-2 pt-2 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
         <div className="flex justify-around items-center h-14">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/trainer' || link.to === '/client'}
                className={({ isActive }) => 
                  `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative ${
                    isActive 
                    ? 'text-[#D4A947]' 
                    : 'text-[#8A8A7A] hover:text-[#F0EDE6]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <link.icon 
                      size={24} 
                      className={`${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(212,169,71,0.8)]' : ''} transition-all`} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className={`text-[10px] font-medium tracking-wide ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                      {link.label}
                    </span>
                    {isActive && (
                      <span className="absolute -top-3 w-8 h-1 bg-[#D4A947] rounded-b-full shadow-[0_0_10px_#D4A947]"></span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
         </div>
      </nav>

    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, X, Smartphone } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Verificar se já está rodando como app standalone (instalado)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    if (isStandalone) return;

    // 2. Verificar se o usuário já fechou o aviso recentemente
    const isDismissed = localStorage.getItem('pwa_install_dismissed') === 'true';
    if (isDismissed) return;

    // 3. Detectar se é iOS (iPhone/iPad)
    const iosDetection = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosDetection);

    // 4. Detectar se é Safari
    const safariDetection = navigator.userAgent.includes('Safari') && 
                            !navigator.userAgent.includes('Chrome') && 
                            !navigator.userAgent.includes('CriOS');
    setIsSafari(safariDetection);

    // 5. Escutar o evento do Chrome/Android para prompt de instalação
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS/Safari, mostramos o banner após 3 segundos
    if (iosDetection && safariDetection) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-[#1A1A1A] border border-[#D4A947]/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Detalhe Dourado Decorativo */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#D4A947] to-transparent" />
        
        <button 
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-[#8A8A7A] hover:text-[#F0EDE6] transition-colors"
        >
          <X size={18} />
        </button>

        {isIOS && isSafari ? (
          /* Mensagem específica para iPhone/Safari */
          <div className="space-y-3 pr-4">
            <div className="flex items-center gap-2 text-[#D4A947]">
              <Smartphone size={20} />
              <h4 className="font-bold text-sm">Instalar no seu iPhone</h4>
            </div>
            <p className="text-xs text-[#8A8A7A] leading-relaxed">
              Adicione este aplicativo à sua tela inicial para acessá-lo como um app nativo com nossa logo:
            </p>
            <ol className="text-xs text-[#F0EDE6] space-y-2 bg-[#0D0D0D] p-3 rounded-xl border border-[#333333]">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4A947]/10 text-[#D4A947] flex items-center justify-center font-bold text-[10px]">1</span>
                Toque no botão de compartilhar <Share size={14} className="text-[#D4A947] inline" /> na barra do navegador.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#D4A947]/10 text-[#D4A947] flex items-center justify-center font-bold text-[10px]">2</span>
                Role para baixo e selecione <span className="font-bold text-[#D4A947]">Adicionar à Tela de Início</span> <PlusSquare size={14} className="inline" />.
              </li>
            </ol>
          </div>
        ) : (
          /* Mensagem para Android / Chrome / Windows / Mac Chrome */
          <div className="space-y-3 pr-4">
            <div className="flex items-center gap-2 text-[#D4A947]">
              <Smartphone size={20} />
              <h4 className="font-bold text-sm">Instalar Aplicativo</h4>
            </div>
            <p className="text-xs text-[#8A8A7A] leading-relaxed">
              Gostaria de criar um atalho na sua tela inicial com a logo do aplicativo e ter acesso rápido e em tela cheia?
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-[#D4A947] text-[#0D0D0D] font-bold text-xs py-2 px-3 rounded-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Instalar Agora
              </button>
              <button
                onClick={handleDismiss}
                className="border border-[#333333] hover:bg-[#252525] text-[#8A8A7A] hover:text-[#F0EDE6] font-bold text-xs py-2 px-3 rounded-lg transition-all"
              >
                Depois
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Utilitário de Resposta Háptica Tátil para Smartphones (iOS / Android)
 * Proporciona sensação física de aplicativo nativo durante interações.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'success':
        navigator.vibrate([15, 40, 25]);
        break;
      case 'warning':
        navigator.vibrate([30, 60, 30]);
        break;
    }
  } catch {
    // Silencioso caso o dispositivo restrinja vibração sem interação do usuário
  }
}

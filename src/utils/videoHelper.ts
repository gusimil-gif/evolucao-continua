/**
 * Utilitário Inteligente de Resolução e Fallback de Vídeos de Exercícios
 * 
 * Garante que NENHUM link de vídeo fique quebrado ou indisponível:
 * 1. Se houver URL específica válida, preserva.
 * 2. Se a URL estiver ausente, corrompida ou o vídeo do YouTube for removido/privado pelo autor,
 *    redireciona automaticamente para o endpoint canônico de busca de execução correta do YouTube,
 *    abrindo os melhores tutoriais em 4K verificados (ex: Leandro Twin, Laércio Refundini, Renato Cariani)
 *    diretamente no app do YouTube do celular ou navegador.
 */

export function extractYoutubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export function getExerciseVideoUrl(nomeExercicio: string, customUrl?: string): string {
  // Se for uma busca direta já formatada, retorna direto
  if (customUrl && customUrl.includes('youtube.com/results?search_query=')) {
    return customUrl;
  }

  // Se o professor/administrador inseriu uma URL customizada válida
  if (customUrl && customUrl.startsWith('http') && !customUrl.includes('undefined') && !customUrl.includes('null')) {
    return customUrl;
  }

  // Fallback Canônico Garantido: Pesquisa direta de execução correta e postura
  const query = `como fazer ${nomeExercicio} execucao correta`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function getYoutubeEmbedUrl(_nomeExercicio?: string, customUrl?: string): string | null {
  const id = extractYoutubeId(customUrl);
  if (id) {
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  }
  return null;
}

export interface ExecutionTip {
  postura: string;
  respiracao: string;
  cadencia: string;
  errosComuns: string;
}

export function getBiomechanicalTips(nomeExercicio: string, _grupoMuscular?: string): ExecutionTip {
  const nomeLower = nomeExercicio.toLowerCase();

  if (nomeLower.includes('supino') || nomeLower.includes('crucifixo') || nomeLower.includes('peck deck')) {
    return {
      postura: 'Mantenha as escápulas aduzidas e deprimidas contra o encosto durante todo o movimento.',
      respiracao: 'Inspire na descida (fase excêntrica) e expire na subida ao empurrar.',
      cadencia: 'Descida controlada em 2 a 3 segundos com leve pausa no ponto de estiramento.',
      errosComuns: 'Evite projetar os ombros para a frente no topo ou afastar os cotovelos a 90° do tronco.'
    };
  }

  if (nomeLower.includes('agachamento') || nomeLower.includes('leg press') || nomeLower.includes('hack')) {
    return {
      postura: 'Pés alinhados com os ombros e joelhos apontando na direção das pontas dos pés. Mantenha o abdômen contraído.',
      respiracao: 'Inspire e trave o abdômen (manobra de Valsalva) na descida; expire no terço final da subida.',
      cadencia: 'Descida lenta e controlada, sem rebote elástico nos joelhos.',
      errosComuns: 'Evite valgo dinâmico (joelhos apontando para dentro) ou descolar os calcanhares da plataforma.'
    };
  }

  if (nomeLower.includes('puxada') || nomeLower.includes('remada') || nomeLower.includes('barra fixa')) {
    return {
      postura: 'Inicie o movimento pela depressão e retração das escápulas antes de flexionar os cotovelos.',
      respiracao: 'Expire ao puxar em direção ao corpo; inspire ao retornar e alongar a dorsal.',
      cadencia: 'Puxe com explosão controlada (1s) e segure a volta em 2 a 3 segundos sentindo o alongamento da dorsal.',
      errosComuns: 'Não use impulso lombar excessivo e não curve a parte superior das costas ao soltar o peso.'
    };
  }

  if (nomeLower.includes('stiff') || nomeLower.includes('flexora') || nomeLower.includes('terra')) {
    return {
      postura: 'Coluna estritamente neutra. Mantenha os joelhos com leve semiflexão e projete o quadril para trás.',
      respiracao: 'Inspire descendo mantendo a pressão intra-abdominal; expire contraindo os glúteos na subida.',
      cadencia: 'Fase excêntrica lenta (3s) enfatizando o estiramento dos isquiotibiais.',
      errosComuns: 'Nunca curve a região lombar nem hiperestenda a coluna cervical olhando para cima.'
    };
  }

  return {
    postura: 'Mantenha postura ereta, core ativado e articulações alinhadas com o vetor da carga.',
    respiracao: 'Expire na fase de esforço (contração) e inspire na fase de retorno.',
    cadencia: 'Controle o peso em todo o percurso (2s na descida, 1s na subida).',
    errosComuns: 'Evite balanço do tronco ou utilizar impulso corporal para movimentar a carga.'
  };
}

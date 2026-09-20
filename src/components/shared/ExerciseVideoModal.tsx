import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { 
  Play, 
  ExternalLink, 
  Video, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Activity,
  Sparkles
} from 'lucide-react';
import { 
  getExerciseVideoUrl, 
  getYoutubeEmbedUrl, 
  getBiomechanicalTips 
} from '../../utils/videoHelper';

interface ExerciseVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: {
    nome: string;
    grupoMuscular?: string;
    videoUrl?: string;
    descricao?: string;
    equipamento?: string;
    dificuldade?: string;
  } | null;
}

export const ExerciseVideoModal: React.FC<ExerciseVideoModalProps> = ({
  isOpen,
  onClose,
  exercise
}) => {
  if (!exercise) return null;

  const embedUrl = getYoutubeEmbedUrl(exercise.nome, exercise.videoUrl);
  const guaranteedUrl = getExerciseVideoUrl(exercise.nome, exercise.videoUrl);
  const tips = getBiomechanicalTips(exercise.nome, exercise.grupoMuscular);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tutorial de Execução • ${exercise.nome}`}
      className="max-w-2xl"
    >
      <div className="space-y-5 text-[#F0EDE6] max-h-[80vh] overflow-y-auto pr-1">
        
        {/* Badges do Exercício */}
        <div className="flex flex-wrap items-center gap-2">
          {exercise.grupoMuscular && (
            <span className="px-3 py-1 bg-[#D4A947]/15 text-[#D4A947] rounded-full text-xs font-bold border border-[#D4A947]/30">
              {exercise.grupoMuscular}
            </span>
          )}
          {exercise.equipamento && (
            <span className="px-3 py-1 bg-[#252525] text-[#8A8A7A] rounded-full text-xs font-medium border border-[#333333]">
              {exercise.equipamento}
            </span>
          )}
          {exercise.dificuldade && (
            <span className="px-3 py-1 bg-[#252525] text-[#8A8A7A] rounded-full text-xs font-medium border border-[#333333]">
              {exercise.dificuldade}
            </span>
          )}
        </div>

        {/* Player de Vídeo ou Card Interativo */}
        <div className="rounded-xl overflow-hidden bg-[#0D0D0D] border border-[#333333] relative">
          {embedUrl ? (
            <div className="aspect-video w-full">
              <iframe
                src={embedUrl}
                title={`Execução de ${exercise.nome}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#1A1A1A] to-[#0D0D0D]">
              <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-3 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <Video size={32} />
              </div>
              <h4 className="font-bold text-[#F0EDE6] text-base mb-1">Vídeo Tutorial em Alta Definição</h4>
              <p className="text-xs text-[#8A8A7A] max-w-sm mb-4">
                Assista à execução correta comentada por especialistas brasileiros credenciados com foco em hipertrofia e segurança articular.
              </p>
              <a
                href={guaranteedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-105"
              >
                <Play size={16} className="fill-white" /> Abrir no YouTube
              </a>
            </div>
          )}
        </div>

        {/* Botão de Ação Direta no YouTube (Garantido 100% sem links quebrados) */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={guaranteedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all text-center"
          >
            <Video size={16} /> Abrir Tutorial Verificado no YouTube <ExternalLink size={14} />
          </a>

          <a
            href={`https://www.youtube.com/results?search_query=como+fazer+${encodeURIComponent(exercise.nome)}+execucao+perfeita+leandro+twin`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#252525] hover:bg-[#333333] border border-[#444] text-[#F0EDE6] font-semibold text-xs py-3 px-4 rounded-xl transition-all"
          >
            <Sparkles size={14} className="text-[#D4A947]" /> Outras Variações
          </a>
        </div>

        {/* Dicas Biomecânicas e de Segurança */}
        <div className="bg-[#141414] border border-[#333333] rounded-xl p-4 space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#D4A947] flex items-center gap-1.5">
            <ShieldCheck size={16} /> Orientações Biomecânicas do Exercício
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#1F1F1F] p-3 rounded-lg border border-[#2D2D2D] space-y-1">
              <span className="text-[#D4A947] font-semibold flex items-center gap-1">
                <CheckCircle2 size={12} /> Postura e Posicionamento:
              </span>
              <p className="text-[#8A8A7A] leading-relaxed">{tips.postura}</p>
            </div>

            <div className="bg-[#1F1F1F] p-3 rounded-lg border border-[#2D2D2D] space-y-1">
              <span className="text-[#D4A947] font-semibold flex items-center gap-1">
                <Activity size={12} /> Respiração & Core:
              </span>
              <p className="text-[#8A8A7A] leading-relaxed">{tips.respiracao}</p>
            </div>

            <div className="bg-[#1F1F1F] p-3 rounded-lg border border-[#2D2D2D] space-y-1">
              <span className="text-[#D4A947] font-semibold flex items-center gap-1">
                <Play size={12} /> Cadência / Tempo:
              </span>
              <p className="text-[#8A8A7A] leading-relaxed">{tips.cadencia}</p>
            </div>

            <div className="bg-[#1F1F1F] p-3 rounded-lg border border-red-500/20 space-y-1">
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle size={12} /> Erros Frequentes a Evitar:
              </span>
              <p className="text-[#8A8A7A] leading-relaxed">{tips.errosComuns}</p>
            </div>
          </div>
        </div>

        {/* Botão Fechar */}
        <div className="pt-2 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
};

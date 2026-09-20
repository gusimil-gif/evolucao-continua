import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { 
  Sparkles, 
  CheckCircle2, 
  Camera, 
  Layers, 
  BookOpen,
  RefreshCw
} from 'lucide-react';
import { generateAIWorkoutPlan, type AIWorkoutAnalysisRequest, type AIWorkoutResponse } from '../../services/aiWorkoutService';
import { getExercisesCached } from '../../services/exerciseCache';
import type { UserData, ExerciseDetails } from '../../types';
import toast from 'react-hot-toast';

interface TrainerAICopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: UserData[];
  selectedClientId: string;
  onApplyWorkout: (data: {
    planName: string;
    planDesc: string;
    activeDays: string[];
    workoutDays: Record<string, ExerciseDetails[]>;
  }) => void;
}

export const TrainerAICopilotModal: React.FC<TrainerAICopilotModalProps> = ({
  isOpen,
  onClose,
  clients,
  selectedClientId,
  onApplyWorkout,
}) => {
  const [clientId, setClientId] = useState<string>(selectedClientId || '');
  const [objetivo, setObjetivo] = useState<'hipertrofia' | 'emagrecimento' | 'forca' | 'condicionamento' | 'definicao'>('hipertrofia');
  const [frequencia, setFrequencia] = useState<number>(4);
  const [nivel, setNivel] = useState<'iniciante' | 'intermediario' | 'avancado'>('intermediario');
  const [tempo, setTempo] = useState<45 | 60 | 75 | 90>(60);
  const [focoMuscular, setFocoMuscular] = useState<AIWorkoutAnalysisRequest['focoMuscular']>('equilibrado');
  const [limitacoes, setLimitacoes] = useState<Array<'lombar' | 'joelhos' | 'ombros' | 'cotovelos' | 'nenhuma'>>(['nenhuma']);
  const [ambiente, setAmbiente] = useState<'academia_completa' | 'smart_fit' | 'condominio' | 'casa'>('academia_completa');
  const [observacoes, setObservacoes] = useState('');
  
  // Imagem Opcional
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);

  // Estados de Geração
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<AIWorkoutResponse | null>(null);

  // Sincronizar cliente selecionado
  React.useEffect(() => {
    if (selectedClientId) {
      setClientId(selectedClientId);
    }
  }, [selectedClientId]);

  const handleToggleLimitacao = (lim: 'lombar' | 'joelhos' | 'ombros' | 'cotovelos' | 'nenhuma') => {
    if (lim === 'nenhuma') {
      setLimitacoes(['nenhuma']);
      return;
    }
    const current = limitacoes.filter(l => l !== 'nenhuma');
    if (current.includes(lim)) {
      const next = current.filter(l => l !== lim);
      setLimitacoes(next.length === 0 ? ['nenhuma'] : next);
    } else {
      setLimitacoes([...current, lim]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      const base64Data = result.split(',')[1];
      setImageBase64(base64Data);
      setImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    const selectedClientObj = clients.find(c => c.uid === clientId);

    setIsGenerating(true);
    setGeneratedPlan(null);

    try {
      const req: AIWorkoutAnalysisRequest = {
        nomeAluno: selectedClientObj?.nome,
        genero: 'unissex',
        objetivo,
        frequenciaDias: frequencia,
        nivel,
        tempoMinutos: tempo,
        focoMuscular,
        limitacoes,
        ambienteTreino: ambiente,
        observacoes,
        imageBase64: imageBase64 || undefined,
        imageMimeType: imageMimeType || undefined
      };

      const response = await generateAIWorkoutPlan(req);
      setGeneratedPlan(response);
      toast.success('Treino científico gerado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar prescrição. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyToWorkspace = async () => {
    if (!generatedPlan) return;

    // Buscar lista de exercícios para vincular IDs corretos
    const exercisesList = await getExercisesCached();

    const activeDays = generatedPlan.dias.map(d => d.diaSemana);
    const workoutDays: Record<string, ExerciseDetails[]> = {};

    generatedPlan.dias.forEach(d => {
      workoutDays[d.diaSemana] = d.exercicios.map((ex, idx) => {
        // Encontrar correspondência na biblioteca de exercícios
        const cleanName = ex.nomeExercicio.toLowerCase().trim();
        const matched = exercisesList.find(e => 
          e.nome.toLowerCase().includes(cleanName) || cleanName.includes(e.nome.toLowerCase())
        );

        const chosenExerciseId = matched ? matched.exerciseId : (exercisesList[idx % exercisesList.length]?.exerciseId || `ex_custom_${idx}`);

        return {
          exerciseId: chosenExerciseId,
          ordem: idx + 1,
          series: Number(ex.series) || 3,
          repeticoes: String(ex.repeticoes || '10-12'),
          descanso: String(ex.descanso || '60s'),
          tipoExecucao: 'SIMP',
          observacoes: ex.observacoes || '',
          tecnica: ex.tecnica || 'Normal'
        };
      });
    });

    onApplyWorkout({
      planName: generatedPlan.nomePlano,
      planDesc: generatedPlan.descricao,
      activeDays,
      workoutDays
    });

    toast.success('Ficha aplicada na Montagem de Treinos com sucesso!');
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Copiloto IA de Prescrição e Montagem • Treinador"
      className="max-w-4xl"
    >
      <div className="space-y-6 text-[#F0EDE6] max-h-[80vh] overflow-y-auto pr-1">
        
        {/* Cabeçalho explicativo */}
        <div className="bg-gradient-to-r from-[#D4A947]/15 to-[#B8922E]/5 p-4 rounded-xl border border-[#D4A947]/30 flex items-start gap-3">
          <Sparkles className="text-[#D4A947] shrink-0 mt-0.5" size={22} />
          <div>
            <h3 className="font-semibold text-[#F0EDE6] text-sm">Prescrição Biomecânica Baseada em Evidências</h3>
            <p className="text-xs text-[#8A8A7A] mt-1 leading-relaxed">
              O Copiloto IA analisa 6 dimensões clínicas (objetivo, nível, tempo, limitações articulares e foco muscular) 
              e prescreve uma periodização hipertrófica imediata com estímulo de alongamento sob tensão e gestão de volume.
            </p>
          </div>
        </div>

        {/* Formulário Estratégico */}
        {!generatedPlan ? (
          <div className="space-y-5">
            {/* Seleção de Aluno */}
            <div>
              <label className="text-xs font-semibold text-[#D4A947] uppercase tracking-wider block mb-1.5">
                1. Aluno(a) Selecionado(a)
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg h-10 px-3 text-sm text-[#F0EDE6] focus:ring-1 focus:ring-[#D4A947] outline-none"
              >
                <option value="">Selecione o aluno para quem prescrever...</option>
                {clients.map(c => (
                  <option key={c.uid} value={c.uid}>
                    {c.nome} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Grid 2 colunas: Objetivo e Nível */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                  2. Objetivo Primário
                </label>
                <select
                  value={objetivo}
                  onChange={e => setObjetivo(e.target.value as any)}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg h-10 px-3 text-sm text-[#F0EDE6] outline-none"
                >
                  <option value="hipertrofia">Hipertrofia Muscular Máxima</option>
                  <option value="definicao">Definição & Recomposição Corporal</option>
                  <option value="emagrecimento">Emagrecimento & Queima Acelerada</option>
                  <option value="forca">Força Bruta / Powerbuilding</option>
                  <option value="condicionamento">Condicionamento & Longevidade</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                  3. Nível de Treinabilidade
                </label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value as any)}
                  className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg h-10 px-3 text-sm text-[#F0EDE6] outline-none"
                >
                  <option value="iniciante">Iniciante (0 a 6 meses de treino)</option>
                  <option value="intermediario">Intermediário (6 meses a 2 anos)</option>
                  <option value="avancado">Avançado (+2 anos com consistência)</option>
                </select>
              </div>
            </div>

            {/* Grid 2 colunas: Frequência e Duração */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                  4. Frequência Semanal
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 4, 5, 6].map(num => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setFrequencia(num)}
                      className={`h-10 rounded-lg text-sm font-semibold border transition-all ${
                        frequencia === num
                          ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                      }`}
                    >
                      {num} Dias
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                  5. Tempo por Sessão
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[45, 60, 75, 90].map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setTempo(m as any)}
                      className={`h-10 rounded-lg text-sm font-semibold border transition-all ${
                        tempo === m
                          ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Foco Muscular Especializado */}
            <div>
              <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                6. Músculo Prioritário / Ponto Fraco (Volume Especializado)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'equilibrado', label: 'Equilibrado' },
                  { id: 'peitoral_superior', label: 'Peitoral Superior' },
                  { id: 'dorsais_largura', label: 'Costas (V-Taper)' },
                  { id: 'gluteos_posterior', label: 'Glúteos & Posterior' },
                  { id: 'ombros_deltoide', label: 'Deltoides 3D' },
                  { id: 'bracos', label: 'Braços (Bíc/Tríc)' },
                  { id: 'quadriceps', label: 'Quadríceps' },
                ].map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setFocoMuscular(item.id as any)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                      focoMuscular === item.id
                        ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                        : 'bg-[#1A1A1A] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Limitações e Dores Articulares */}
            <div>
              <label className="text-xs font-semibold text-red-400 uppercase tracking-wider block mb-1.5">
                7. Dores ou Restrições Articulares (Ajuste Biomecânico Automático)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'nenhuma', label: 'Nenhuma Dor' },
                  { id: 'lombar', label: 'Coluna / Lombar' },
                  { id: 'joelhos', label: 'Joelhos' },
                  { id: 'ombros', label: 'Ombros / Manguito' },
                  { id: 'cotovelos', label: 'Cotovelos' },
                ].map(lim => {
                  const isSelected = limitacoes.includes(lim.id as any);
                  return (
                    <button
                      type="button"
                      key={lim.id}
                      onClick={() => handleToggleLimitacao(lim.id as any)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? lim.id === 'nenhuma'
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'bg-red-500/20 border-red-500 text-red-300'
                          : 'bg-[#1A1A1A] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                      }`}
                    >
                      {lim.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ambiente e Estrutura */}
            <div>
              <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                8. Estrutura de Treino / Aparelhagem
              </label>
              <select
                value={ambiente}
                onChange={e => setAmbiente(e.target.value as any)}
                className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg h-10 px-3 text-sm text-[#F0EDE6] outline-none"
              >
                <option value="academia_completa">Academia Completa (Barras, Máquinas, Cabos, Hack)</option>
                <option value="smart_fit">Academia Comercial (Smart Fit, Bio Ritmo - foco em cabos/articulados)</option>
                <option value="condominio">Academia de Condomínio (Halteres, banco e polia simples)</option>
                <option value="casa">Treino em Casa (Halteres ajustáveis e peso corporal)</option>
              </select>
            </div>

            {/* Observações Clínicas / Pedidos Especiais */}
            <div>
              <label className="text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider block mb-1.5">
                9. Observações do Treinador ou Pedidos do Aluno (Opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Ex: Aluno prefere séries de alta intensidade e pouco tempo de descanso; incluir cardio pós-treino..."
                className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg p-3 text-sm text-[#F0EDE6] outline-none focus:border-[#D4A947] resize-none"
              />
            </div>

            {/* Foto Postural Opcional */}
            <div className="border border-[#333333] border-dashed rounded-xl p-4 bg-[#141414]">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[#F0EDE6] flex items-center gap-2">
                    <Camera size={16} className="text-[#D4A947]" />
                    Foto Postural do Aluno (100% Opcional)
                  </h4>
                  <p className="text-xs text-[#8A8A7A] mt-0.5">
                    Caso o aluno tenha enviado foto com roupa de treino, anexe para a IA validar assimetrias e proporção.
                  </p>
                </div>
                <label className="cursor-pointer bg-[#252525] hover:bg-[#333333] text-[#F0EDE6] text-xs font-semibold px-3 py-2 rounded-lg border border-[#444] transition-colors">
                  {imagePreview ? 'Alterar Foto' : 'Subir Foto'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>

              {imagePreview && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={imagePreview} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-[#D4A947]/50" />
                  <span className="text-xs text-green-400 font-medium">Foto carregada e pronta para análise visual</span>
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="pt-2 flex justify-end gap-3 border-t border-[#333333]">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button 
                type="button" 
                onClick={handleGenerate} 
                isLoading={isGenerating}
                className="bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] font-bold"
              >
                <Sparkles size={18} className="mr-2" />
                Gerar Treino Científico com IA
              </Button>
            </div>
          </div>
        ) : (
          /* Visualização do Plano Gerado */
          <div className="space-y-6 animate-in fade-in">
            {/* Header do Resultado */}
            <div className="bg-[#1A1A1A] p-5 rounded-xl border border-[#333333] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#D4A947] uppercase tracking-wider">Prescrição Gerada</span>
                  <h2 className="text-xl font-bold text-[#F0EDE6]">{generatedPlan.nomePlano}</h2>
                </div>
                <button 
                  onClick={() => setGeneratedPlan(null)} 
                  className="text-xs text-[#8A8A7A] hover:text-[#F0EDE6] flex items-center gap-1 border border-[#333333] px-3 py-1.5 rounded-lg self-start"
                >
                  <RefreshCw size={14} /> Refazer Anamnese
                </button>
              </div>

              <p className="text-sm text-[#8A8A7A]">{generatedPlan.descricao}</p>

              {/* Fundamentação Científica */}
              {generatedPlan.fundamentacaoCientifica && (
                <div className="bg-[#0D0D0D] p-3.5 rounded-lg border border-[#333333] text-xs text-[#8A8A7A] space-y-1">
                  <p className="font-semibold text-[#D4A947] flex items-center gap-1">
                    <BookOpen size={14} /> Fundamentação Científica & Biomecânica:
                  </p>
                  <p className="whitespace-pre-line leading-relaxed">{generatedPlan.fundamentacaoCientifica}</p>
                </div>
              )}
            </div>

            {/* Listagem dos Dias e Exercícios */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-[#F0EDE6] uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} className="text-[#D4A947]" />
                Divisão Prescrita ({generatedPlan.dias.length} Treinos)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedPlan.dias.map(d => (
                  <div key={d.diaSemana} className="bg-[#1A1A1A] p-4 rounded-xl border border-[#333333] space-y-3">
                    <div className="border-b border-[#333333] pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#D4A947] text-sm">{d.diaSemana}</span>
                        <span className="text-xs text-[#8A8A7A] bg-[#252525] px-2 py-0.5 rounded">
                          {d.exercicios.length} exercícios
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm text-[#F0EDE6]">{d.nomeTreino}</h4>
                    </div>

                    <div className="space-y-2">
                      {d.exercicios.map((ex, idx) => (
                        <div key={idx} className="bg-[#252525] p-2.5 rounded-lg text-xs flex justify-between items-center gap-2">
                          <div className="truncate flex-1">
                            <p className="font-semibold text-[#F0EDE6] truncate">{ex.nomeExercicio}</p>
                            <p className="text-[11px] text-[#8A8A7A]">
                              {ex.tecnica ? `${ex.tecnica} • ` : ''}{ex.observacoes || ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[#D4A947] font-bold">{ex.series}x</span>{' '}
                            <span className="text-[#F0EDE6]">{ex.repeticoes}</span>
                            <div className="text-[10px] text-[#8A8A7A]">{ex.descanso} rest</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-[#8A8A7A] border-t border-[#333333] pt-4 leading-relaxed">
              {generatedPlan.disclaimer}
            </p>

            {/* Ações Finais */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
              <Button 
                type="button" 
                onClick={handleApplyToWorkspace}
                className="bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] font-bold px-6"
              >
                <CheckCircle2 size={18} className="mr-2" />
                Aplicar Diretamente na Ficha do Aluno
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { generateAIWorkoutPlan, type AIWorkoutAnalysisRequest, type AIWorkoutResponse } from '../../services/aiWorkoutService';
import { getExercisesCached } from '../../services/exerciseCache';
import { 
  Sparkles, 
  Camera, 
  ArrowRight, 
  ShieldAlert, 
  Dumbbell, 
  RefreshCw, 
  BookOpen, 
  FileText 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const AIWorkoutGenerator: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'form' | 'loading' | 'result'>('form');
  const [mode, setMode] = useState<'questionnaire' | 'photo'>('questionnaire');

  // Parâmetros da Anamnese Científica
  const [objetivo, setObjetivo] = useState<'hipertrofia' | 'emagrecimento' | 'forca' | 'condicionamento' | 'definicao'>('hipertrofia');
  const [frequencia, setFrequencia] = useState<number>(4);
  const [nivel, setNivel] = useState<'iniciante' | 'intermediario' | 'avancado'>('intermediario');
  const [tempo, setTempo] = useState<45 | 60 | 75 | 90>(60);
  const [focoMuscular, setFocoMuscular] = useState<AIWorkoutAnalysisRequest['focoMuscular']>('equilibrado');
  const [limitacoes, setLimitacoes] = useState<Array<'lombar' | 'joelhos' | 'ombros' | 'cotovelos' | 'nenhuma'>>(['nenhuma']);
  const [ambiente, setAmbiente] = useState<'academia_completa' | 'smart_fit' | 'condominio' | 'casa'>('academia_completa');
  const [observacoes, setObservacoes] = useState('');
  
  // Imagem (Opcional)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);

  // Resultado da IA
  const [generatedPlan, setGeneratedPlan] = useState<AIWorkoutResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setImageBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    setStep('loading');
    try {
      const response = await generateAIWorkoutPlan({
        nomeAluno: userData?.nome,
        imageBase64: mode === 'photo' ? imageBase64 : undefined,
        imageMimeType: mode === 'photo' ? (imageFile?.type || 'image/jpeg') : undefined,
        objetivo,
        frequenciaDias: frequencia,
        nivel,
        tempoMinutos: tempo,
        focoMuscular,
        limitacoes,
        ambienteTreino: ambiente,
        observacoes
      });

      setGeneratedPlan(response);
      setStep('result');
      toast.success('Ficha de treino gerada com sucesso pela IA! 🔥');
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao processar com a IA. Tente novamente.');
      setStep('form');
    }
  };

  const handleApplyPlan = async () => {
    if (!userData?.uid || !generatedPlan) return;
    setIsSaving(true);
    try {
      // 1. Desativar qualquer plano ativo existente do aluno
      const qExisting = query(
        collection(db, 'workoutPlans'),
        where('clientId', '==', userData.uid),
        where('ativo', '==', true)
      );
      const exSnap = await getDocs(qExisting);
      for (const exDoc of exSnap.docs) {
        await updateDoc(doc(db, 'workoutPlans', exDoc.id), { ativo: false });
      }

      // 2. Buscar biblioteca de exercícios para vincular IDs reais (instantâneo do cache)
      const exercisesList = await getExercisesCached();

      const diasSemana = generatedPlan.dias.map(d => d.diaSemana);

      // 3. Criar o novo WorkoutPlan
      const newPlanRef = await addDoc(collection(db, 'workoutPlans'), {
        clientId: userData.uid,
        trainerId: userData.trainerId || 'piVnSDRpv8SOpmdSzmDbpWCSwFc2',
        nomePlano: generatedPlan.nomePlano,
        descricao: generatedPlan.descricao,
        diasDaSemana: diasSemana,
        dataCriacao: new Date(),
        dataInicio: new Date(),
        dataFim: null,
        ativo: true
      });

      // 4. Salvar cada WorkoutDay com seus respectivos exercícios
      for (let i = 0; i < generatedPlan.dias.length; i++) {
        const d = generatedPlan.dias[i];

        const exerciciosFormatados = d.exercicios.map((ex, idx) => {
          const cleanName = ex.nomeExercicio.toLowerCase().trim();
          const matchedEx = exercisesList.find(e => 
            e.nome.toLowerCase().includes(cleanName) || cleanName.includes(e.nome.toLowerCase())
          );

          return {
            exerciseId: matchedEx ? matchedEx.exerciseId : (exercisesList[idx % exercisesList.length]?.exerciseId || 'ex-default'),
            ordem: idx + 1,
            series: Number(ex.series) || 3,
            repeticoes: String(ex.repeticoes || '10-12'),
            descanso: String(ex.descanso || '60s'),
            tipoExecucao: 'SIMP',
            observacoes: ex.observacoes || '',
            tecnica: ex.tecnica || 'Normal'
          };
        });

        await addDoc(collection(db, 'workoutDays'), {
          planId: newPlanRef.id,
          diaSemana: d.diaSemana,
          nomeTreino: d.nomeTreino,
          ordem: i,
          exercicios: exerciciosFormatados
        });
      }

      toast.success('Seu novo treino foi salvo e ativado na sua tela principal!');
      navigate('/client');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar o treino gerado.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#333333] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4A947]/10 border border-[#D4A947]/30 text-[#D4A947] text-xs font-bold mb-2">
            <Sparkles size={14} /> IA EM TEMPO REAL • BIOMECÂNICA CIENTÍFICA
          </div>
          <h1 className="text-3xl font-black text-[#F0EDE6] tracking-tight">Prescrição de Treino por IA</h1>
          <p className="text-[#8A8A7A] text-sm mt-1">
            Periodização baseada em hipertrofia mediada pelo alongamento, alívio articular e gestão de volume.
          </p>
        </div>
      </div>

      {/* AVISO MÉDICO / RESPONSABILIDADE */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-300 text-xs leading-relaxed">
        <ShieldAlert size={20} className="shrink-0 text-amber-400 mt-0.5" />
        <div>
          <strong className="block text-amber-200 text-sm mb-0.5">Aviso de Responsabilidade Técnica</strong>
          Esta ferramenta é um copiloto de biomecânica por Inteligência Artificial. Ela <strong>não substitui</strong> o acompanhamento presencial do seu Personal Trainer ou profissional de Educação Física credenciado pelo CREF.
        </div>
      </div>

      {/* ETAPA 1: FORMULÁRIO */}
      {step === 'form' && (
        <Card className="bg-[#1A1A1A] border-[#333333] space-y-6 p-6">
          
          {/* SELETOR DE MODO: QUESTIONÁRIO ESTRATÉGICO VS FOTO */}
          <div>
            <label className="block text-xs font-semibold text-[#D4A947] uppercase tracking-wider mb-2">
              Escolha Como Deseja Prescrever:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('questionnaire')}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  mode === 'questionnaire'
                    ? 'bg-[#D4A947]/15 border-[#D4A947] text-[#F0EDE6]'
                    : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                }`}
              >
                <FileText className={`mt-0.5 shrink-0 ${mode === 'questionnaire' ? 'text-[#D4A947]' : 'text-[#8A8A7A]'}`} size={20} />
                <div>
                  <h4 className="text-sm font-bold text-[#F0EDE6]">Anamnese Científica (Sem Foto)</h4>
                  <p className="text-xs text-[#8A8A7A] mt-0.5">
                    Responda perguntas estratégicas de objetivo, dores articulares e ponto fraco.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('photo')}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  mode === 'photo'
                    ? 'bg-[#D4A947]/15 border-[#D4A947] text-[#F0EDE6]'
                    : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                }`}
              >
                <Camera className={`mt-0.5 shrink-0 ${mode === 'photo' ? 'text-[#D4A947]' : 'text-[#8A8A7A]'}`} size={20} />
                <div>
                  <h4 className="text-sm font-bold text-[#F0EDE6]">Análise Completa com Foto</h4>
                  <p className="text-xs text-[#8A8A7A] mt-0.5">
                    Envie uma foto de roupa normal para a IA detectar assimetrias e proporção física.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* UPLOAD DE FOTO (SE MODO FOTO ATIVO) */}
          {mode === 'photo' && (
            <div className="border border-[#333333] rounded-xl p-4 bg-[#141414] animate-in fade-in">
              <label className="block text-sm font-bold text-[#F0EDE6] mb-1">
                Sua Foto Postural (Roupa de Academia ou Normal)
              </label>
              <p className="text-xs text-[#8A8A7A] mb-3">
                A IA analisará seu biotipo e proporções para balancear o volume entre tronco e pernas.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#252525] border border-[#333333] hover:border-[#D4A947] text-[#F0EDE6] text-sm font-medium transition-colors">
                  <Camera size={18} className="text-[#D4A947]" />
                  {imageFile ? 'Trocar Foto' : 'Tirar ou Selecionar Foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>

                {imagePreview && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#D4A947]">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1. OBJETIVO & NÍVEL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
                1. Objetivo Primário
              </label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={objetivo}
                onChange={(e: any) => setObjetivo(e.target.value)}
              >
                <option value="hipertrofia">Ganho Máximo de Massa Muscular (Hipertrofia)</option>
                <option value="definicao">Definição Muscular & Recomposição</option>
                <option value="emagrecimento">Emagrecimento Acelerado & Queima</option>
                <option value="forca">Força Pura & Powerbuilding</option>
                <option value="condicionamento">Condicionamento Físico & Longevidade</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
                2. Nível de Experiência
              </label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={nivel}
                onChange={(e: any) => setNivel(e.target.value)}
              >
                <option value="iniciante">Iniciante (menos de 6 meses de treino)</option>
                <option value="intermediario">Intermediário (6 meses a 2 anos consistentes)</option>
                <option value="avancado">Avançado (mais de 2 anos com seriedade)</option>
              </select>
            </div>
          </div>

          {/* 2. FREQUÊNCIA E TEMPO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
                3. Dias na Semana Disponíveis
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map(num => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setFrequencia(num)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-all ${
                      frequencia === num
                        ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                        : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                    }`}
                  >
                    {num} Dias
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
                4. Duração por Sessão de Treino
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[45, 60, 75, 90].map(m => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setTempo(m as any)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-all ${
                      tempo === m
                        ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                        : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                    }`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. MÚSCULO FOCO / PONTO FRACO */}
          <div>
            <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
              5. Músculo Alvo / Ponto Fraco a Destacar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'equilibrado', label: 'Equilibrado' },
                { id: 'peitoral_superior', label: 'Peitoral Superior' },
                { id: 'dorsais_largura', label: 'Costas (V-Taper)' },
                { id: 'gluteos_posterior', label: 'Glúteos & Posterior' },
                { id: 'ombros_deltoide', label: 'Deltoides 3D' },
                { id: 'bracos', label: 'Braços (Bíceps/Tríceps)' },
                { id: 'quadriceps', label: 'Quadríceps' },
              ].map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setFocoMuscular(item.id as any)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                    focoMuscular === item.id
                      ? 'bg-[#D4A947]/20 border-[#D4A947] text-[#D4A947]'
                      : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. DORES E RESTRIÇÕES ARTICULARES */}
          <div>
            <label className="block text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
              6. Desconfortos ou Dores Articulares (A IA ajustará os exercícios automaticamente)
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
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? lim.id === 'nenhuma'
                          ? 'bg-green-500/20 border-green-500 text-green-400'
                          : 'bg-red-500/20 border-red-500 text-red-300'
                        : 'bg-[#252525] border-[#333333] text-[#8A8A7A] hover:border-[#555]'
                    }`}
                  >
                    {lim.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. ESTRUTURA DA ACADEMIA */}
          <div>
            <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
              7. Onde você treina?
            </label>
            <select
              value={ambiente}
              onChange={e => setAmbiente(e.target.value as any)}
              className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
            >
              <option value="academia_completa">Academia Completa Tradicional (Barras, Anilhas, Máquinas e Cabos)</option>
              <option value="smart_fit">Rede de Academia Comercial (Smart Fit, Bio Ritmo, Bluefit - foco em cabos/articulados)</option>
              <option value="condominio">Academia de Condomínio / Prédio (Halteres, banco e polia)</option>
              <option value="casa">Treino em Casa (Halteres ajustáveis ou peso corporal)</option>
            </select>
          </div>

          {/* 6. OBSERVAÇÕES */}
          <div>
            <label className="block text-xs font-semibold text-[#8A8A7A] uppercase tracking-wider mb-2">
              8. Observações Adicionais (Opcional)
            </label>
            <textarea
              className="w-full h-20 bg-[#252525] border border-[#333333] rounded-xl p-3 text-sm text-[#F0EDE6] outline-none focus:border-[#D4A947] resize-none"
              placeholder="Ex: Gostaria de priorizar cardio no final dos treinos..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] border-none shadow-[0_0_25px_rgba(212,169,71,0.3)] hover:scale-[1.01]"
          >
            <Sparkles size={20} className="mr-2" /> Gerar Ficha Científica com IA
          </Button>
        </Card>
      )}

      {/* ETAPA 2: CARREGANDO */}
      {step === 'loading' && (
        <Card className="bg-[#1A1A1A] border-[#333333] p-12 text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#D4A947]/20 border-t-[#D4A947] rounded-full animate-spin mx-auto"></div>
          <h3 className="text-xl font-bold text-[#F0EDE6]">A Inteligência Artificial está prescrevendo seu treino...</h3>
          <p className="text-sm text-[#8A8A7A] max-w-md mx-auto">
            Calculando hipertrofia mediada pelo alongamento, alívio articular e gestão de volume semanal ideal.
          </p>
        </Card>
      )}

      {/* ETAPA 3: RESULTADO */}
      {step === 'result' && generatedPlan && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Card Resumo do Diagnóstico */}
          <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-[#D4A947]/40 p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#D4A947] text-xs font-bold uppercase tracking-wider">
              <Sparkles size={16} /> Prescrição Gerada pela IA
            </div>
            <h2 className="text-2xl font-black text-[#F0EDE6]">{generatedPlan.nomePlano}</h2>
            <p className="text-[#8A8A7A] text-sm">{generatedPlan.descricao}</p>
            
            <div className="bg-[#0D0D0D] border border-[#333333] rounded-xl p-4 text-xs text-[#F0EDE6] leading-relaxed">
              <strong className="text-[#D4A947] block mb-1">Diagnóstico Biomecânico:</strong>
              {generatedPlan.diagnosticoVisual}
            </div>

            {generatedPlan.fundamentacaoCientifica && (
              <div className="bg-[#0D0D0D] border border-[#333333] rounded-xl p-4 text-xs text-[#8A8A7A] leading-relaxed">
                <strong className="text-[#D4A947] flex items-center gap-1 mb-1">
                  <BookOpen size={14} /> Fundamentação Científica:
                </strong>
                <p className="whitespace-pre-line">{generatedPlan.fundamentacaoCientifica}</p>
              </div>
            )}
          </Card>

          {/* Listagem dos Dias Propostos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedPlan.dias.map((dia, idx) => (
              <Card key={idx} className="bg-[#1A1A1A] border-[#333333] p-5 space-y-4">
                <div className="border-b border-[#333333] pb-3">
                  <span className="text-xs font-bold text-[#D4A947] uppercase tracking-wider">{dia.diaSemana}</span>
                  <h3 className="text-lg font-bold text-[#F0EDE6]">{dia.nomeTreino}</h3>
                  <p className="text-xs text-[#8A8A7A]">{dia.foco}</p>
                </div>

                <div className="space-y-2">
                  {dia.exercicios.map((ex, eIdx) => (
                    <div key={eIdx} className="bg-[#0D0D0D] p-3 rounded-xl border border-[#333333]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Dumbbell size={16} className="text-[#D4A947]" />
                        <div>
                          <p className="text-sm font-semibold text-[#F0EDE6]">{ex.nomeExercicio}</p>
                          <p className="text-[11px] text-[#8A8A7A]">
                            {ex.series} séries • {ex.repeticoes} • {ex.descanso}
                            {ex.tecnica ? ` • ${ex.tecnica}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setStep('form')}
              className="flex-1"
            >
              <RefreshCw size={16} className="mr-2" /> Ajustar Parâmetros
            </Button>

            <Button 
              onClick={handleApplyPlan}
              disabled={isSaving}
              className="flex-1 bg-[#D4A947] text-[#0D0D0D] hover:bg-[#C9A03C] font-bold text-base h-14"
            >
              {isSaving ? 'Salvando no Seu App...' : <>Ativar Este Treino na Minha Conta <ArrowRight size={18} className="ml-2" /></>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIWorkoutGenerator;

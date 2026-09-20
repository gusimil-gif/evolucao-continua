import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { generateAIWorkoutPlan, type AIWorkoutResponse } from '../../services/aiWorkoutService';
import { Sparkles, Camera, ArrowRight, ShieldAlert, Dumbbell, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const AIWorkoutGenerator: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'form' | 'loading' | 'result'>('form');
  const [objetivo, setObjetivo] = useState<'hipertrofia' | 'emagrecimento' | 'condicionamento' | 'definicao'>('hipertrofia');
  const [frequencia, setFrequencia] = useState<number>(4);
  const [nivel, setNivel] = useState<'iniciante' | 'intermediario' | 'avancado'>('intermediario');
  const [genero, setGenero] = useState<'masculino' | 'feminino' | 'unissex'>('unissex');
  const [observacoes, setObservacoes] = useState('');
  
  // Imagem
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);

  // Resultado da IA
  const [generatedPlan, setGeneratedPlan] = useState<AIWorkoutResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        imageBase64,
        imageMimeType: imageFile?.type || 'image/jpeg',
        objetivo,
        frequenciaDias: frequencia,
        nivel,
        genero,
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

      // 2. Buscar biblioteca de exercícios para vincular IDs reais
      const exSnapAll = await getDocs(collection(db, 'exercises'));
      const exercisesList = exSnapAll.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const diasSemana = generatedPlan.dias.map(d => d.diaSemana);

      // 3. Criar o novo WorkoutPlan
      const newPlanRef = await addDoc(collection(db, 'workoutPlans'), {
        clientId: userData.uid,
        trainerId: userData.trainerId || 'ai-trainer',
        nomePlano: generatedPlan.nomePlano,
        descricao: generatedPlan.descricao,
        diasDaSemana: diasSemana,
        dataCriacao: new Date(),
        dataInicio: new Date(),
        dataFim: null,
        ativo: true,
        geradoPorIA: true
      });

      // 4. Criar cada WorkoutDay
      for (let i = 0; i < generatedPlan.dias.length; i++) {
        const d = generatedPlan.dias[i];
        
        // Mapear exercícios gerados pela IA para os exercícios do catálogo
        const exerciciosFormatados = d.exercicios.map((ex, idx) => {
          // Tenta encontrar exercício mais próximo pelo nome
          const matchedEx = exercisesList.find(e => 
            e.nome.toLowerCase().includes(ex.nomeExercicio.toLowerCase()) ||
            ex.nomeExercicio.toLowerCase().includes(e.nome.toLowerCase())
          );

          return {
            exerciseId: matchedEx ? matchedEx.id : (exercisesList[0]?.id || 'ex-default'),
            ordem: idx,
            series: Number(ex.series) || 3,
            repeticoes: String(ex.repeticoes || '10-12'),
            descanso: String(ex.descanso || '60s'),
            tipoExecucao: 'SIMP'
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
            <Sparkles size={14} /> NOVIDADE • IA EM TEMPO REAL
          </div>
          <h1 className="text-3xl font-black text-[#F0EDE6] tracking-tight">Prescrição de Treino por IA</h1>
          <p className="text-[#8A8A7A] text-sm mt-1">
            Envie sua foto e receba uma periodização completa recomendada para sua estrutura física e objetivos.
          </p>
        </div>
      </div>

      {/* AVISO MÉDICO / RESPONSABILIDADE */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-amber-300 text-xs leading-relaxed">
        <ShieldAlert size={20} className="shrink-0 text-amber-400 mt-0.5" />
        <div>
          <strong className="block text-amber-200 text-sm mb-0.5">Aviso de Responsabilidade e Saúde</strong>
          Esta ferramenta é uma assistente biomecânica baseada em Inteligência Artificial para auxílio e sugestão de rotinas. 
          Ela <strong>não substitui</strong> a anamnese presencial de um Personal Trainer ou profissional de Educação Física credenciado pelo CREF. 
          Use com sabedoria, respeite seus limites e execute cada carga com moderação.
        </div>
      </div>

      {/* ETAPA 1: FORMULÁRIO */}
      {step === 'form' && (
        <Card className="bg-[#1A1A1A] border-[#333333] space-y-6">
          {/* UPLOAD DE FOTO */}
          <div>
            <label className="block text-sm font-bold text-[#F0EDE6] mb-2">
              Foto de Corpo Inteiro (Opcional - Roupa Normal)
            </label>
            <p className="text-xs text-[#8A8A7A] mb-3">
              A IA analisará sua postura e proporção corporal para equilibrar grupos musculares prioritários.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#252525] border border-[#333333] hover:border-[#D4A947] text-[#F0EDE6] text-sm font-medium transition-colors">
                <Camera size={18} className="text-[#D4A947]" />
                {imageFile ? 'Trocar Foto' : 'Selecionar Foto da Galeria'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>

              {imagePreview && (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[#D4A947]">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OBJETIVO */}
            <div>
              <label className="block text-sm font-bold text-[#F0EDE6] mb-2">Objetivo Principal</label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={objetivo}
                onChange={(e: any) => setObjetivo(e.target.value)}
              >
                <option value="hipertrofia">Ganho de Massa Muscular (Hipertrofia)</option>
                <option value="emagrecimento">Emagrecimento e Queima de Gordura</option>
                <option value="definicao">Definição Muscular (Recomposição)</option>
                <option value="condicionamento">Condicionamento Físico Geral</option>
              </select>
            </div>

            {/* FREQUÊNCIA */}
            <div>
              <label className="block text-sm font-bold text-[#F0EDE6] mb-2">Frequência Semanal</label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={frequencia}
                onChange={(e) => setFrequencia(Number(e.target.value))}
              >
                <option value={3}>3 dias na semana (Treino A, B e C)</option>
                <option value={4}>4 dias na semana (Treino A, B, C e D)</option>
                <option value={5}>5 dias na semana (Treino A, B, C, D e E)</option>
              </select>
            </div>

            {/* NÍVEL */}
            <div>
              <label className="block text-sm font-bold text-[#F0EDE6] mb-2">Nível de Experiência</label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={nivel}
                onChange={(e: any) => setNivel(e.target.value)}
              >
                <option value="iniciante">Iniciante (menos de 6 meses)</option>
                <option value="intermediario">Intermediário (6 meses a 2 anos)</option>
                <option value="avancado">Avançado (mais de 2 anos)</option>
              </select>
            </div>

            {/* GÊNERO */}
            <div>
              <label className="block text-sm font-bold text-[#F0EDE6] mb-2">Foco Anatômico</label>
              <select 
                className="w-full bg-[#252525] border border-[#333333] rounded-xl h-11 px-4 text-[#F0EDE6] outline-none text-sm focus:border-[#D4A947]"
                value={genero}
                onChange={(e: any) => setGenero(e.target.value)}
              >
                <option value="unissex">Geral / Equilibrado</option>
                <option value="masculino">Foco Superior (Peitoral, Costas e Braços)</option>
                <option value="feminino">Foco Inferior (Glúteos, Quadríceps e Posterior)</option>
              </select>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div>
            <label className="block text-sm font-bold text-[#F0EDE6] mb-2">Observações / Limitações Físicas</label>
            <textarea
              className="w-full h-24 bg-[#252525] border border-[#333333] rounded-xl p-4 text-sm text-[#F0EDE6] outline-none focus:border-[#D4A947] resize-none"
              placeholder="Ex: Sinto desconforto no joelho em agachamento profundo, prefiro máquinas..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            className="w-full h-14 text-base font-bold bg-gradient-to-r from-[#D4A947] to-[#B8922E] text-[#0D0D0D] border-none shadow-[0_0_25px_rgba(212,169,71,0.3)] hover:scale-[1.01]"
          >
            <Sparkles size={20} className="mr-2" /> Analisar e Criar Ficha com IA
          </Button>
        </Card>
      )}

      {/* ETAPA 2: CARREGANDO */}
      {step === 'loading' && (
        <Card className="bg-[#1A1A1A] border-[#333333] p-12 text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#D4A947]/20 border-t-[#D4A947] rounded-full animate-spin mx-auto"></div>
          <h3 className="text-xl font-bold text-[#F0EDE6]">A Inteligência Artificial está prescrevendo seu treino...</h3>
          <p className="text-sm text-[#8A8A7A] max-w-md mx-auto">
            Analisando volume ótimo de repetições, divisões de grupos musculares e compatibilidade biomecânica com o catálogo.
          </p>
        </Card>
      )}

      {/* ETAPA 3: RESULTADO */}
      {step === 'result' && generatedPlan && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Card Resumo do Diagnóstico */}
          <Card className="bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D] border-[#D4A947]/40 p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#D4A947] text-xs font-bold uppercase tracking-wider">
              <Sparkles size={16} /> Ficha Gerada pela IA
            </div>
            <h2 className="text-2xl font-black text-[#F0EDE6]">{generatedPlan.nomePlano}</h2>
            <p className="text-[#8A8A7A] text-sm">{generatedPlan.descricao}</p>
            
            <div className="bg-[#0D0D0D] border border-[#333333] rounded-xl p-4 text-xs text-[#F0EDE6] leading-relaxed">
              <strong className="text-[#D4A947] block mb-1">Diagnóstico Biomecânico:</strong>
              {generatedPlan.diagnosticoVisual}
            </div>
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
                          <p className="text-[11px] text-[#8A8A7A]">{ex.series} séries • {ex.repeticoes} reps • {ex.descanso}</p>
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

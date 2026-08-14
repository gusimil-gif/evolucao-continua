import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../services/firebaseConfig';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Award, Timer, Flame, CheckCircle2 } from 'lucide-react';
import type { WorkoutLog, MotivationalQuote } from '../../types';

export const CompletionScreen: React.FC = () => {
  const { logId } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [quote, setQuote] = useState('');

  useEffect(() => {
    const fetchCompletionData = async () => {
      // Fetch Log
      if (logId) {
        const d = await getDoc(doc(db, 'workoutLogs', logId));
        if (d.exists()) setLog(d.data() as WorkoutLog);
      }
      // Fetch Random Quote safely (In reality we select one and shuffle, or pick via index randomizing)
      try {
         const qQ = query(collection(db, 'motivationalQuotes'), limit(10)); // Pick top 10 and random
         const quotesSnap = await getDocs(qQ);
         const docs = quotesSnap.docs.map(doc => (doc.data() as MotivationalQuote).texto);
         if (docs.length > 0) {
           const rand = Math.floor(Math.random() * docs.length);
           setQuote(docs[rand]);
         }
      } catch(e) {}
    };
    fetchCompletionData();
  }, [logId]);

  if (!log) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#D4A947]/10 to-[#0D0D0D] flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
      
      {/* Icon Area */}
      <div className="w-24 h-24 bg-[#D4A947] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(212,169,71,0.4)] mb-8">
        <CheckCircle2 size={48} className="text-[#0D0D0D]" />
      </div>

      <h1 className="text-4xl font-black text-[#F0EDE6] mb-2 tracking-tight">TREINO CONCLUÍDO!</h1>
      <p className="text-[#D4A947] font-medium text-lg mb-8">Obrigado por se dedicar hoje.</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-10">
        <Card className="flex flex-col items-center justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur border-[#D4A947]/20">
          <Timer className="text-[#8A8A7A] mb-2" size={24} />
          <p className="text-2xl font-bold text-[#F0EDE6]">{log.tempoTotal}m</p>
          <p className="text-xs text-[#8A8A7A] uppercase tracking-wide">Tempo Total</p>
        </Card>
        
        <Card className="flex flex-col items-center justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur border-[#D4A947]/20">
          <Flame className="text-orange-500 mb-2" size={24} />
          <p className="text-2xl font-bold text-[#F0EDE6]">{log.exerciciosExecutados.length}</p>
          <p className="text-xs text-[#8A8A7A] uppercase tracking-wide">Exercícios</p>
        </Card>
      </div>

      <div className="max-w-md mx-auto mb-12">
        <p className="text-xl italic text-[#8A8A7A]">"{quote || 'A disciplina é a ponte entre seus objetivos e suas conquistas.'}"</p>
      </div>

      <div className="flex flex-col w-full max-w-sm gap-3">
        <Button onClick={() => navigate('/client/progress')} className="h-14 text-lg">
          <Award className="mr-2" /> Ver Evolução
        </Button>
        <Button variant="ghost" onClick={() => navigate('/client')} className="h-14 text-lg">
          Voltar ao Início
        </Button>
      </div>

    </div>
  );
};

export default CompletionScreen;

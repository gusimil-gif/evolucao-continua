import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { TrendingUp, Activity, Image as ImageIcon, Camera, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const ProgressCharts: React.FC = () => {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'charts' | 'photos'>('charts');
  
  // Charts States
  const [logs, setLogs] = useState<any[]>([]);
  const [exercisesMeta, setExercisesMeta] = useState<Record<string, string>>({});
  const [selectedEx, setSelectedEx] = useState<string>('');

  // Photos States
  const [photos, setPhotos] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const fetchProgress = async () => {
      if (!userData?.uid) return;
      
      // Fetch Logs
      const q = query(collection(db, 'workoutLogs'), where('clientId', '==', userData.uid), orderBy('dataExecucao', 'asc'));
      const qSnap = await getDocs(q);
      const fetchedLogs = qSnap.docs.map(d => {
         const data = d.data();
         return { ...data, id: d.id, date: data.dataExecucao?.toDate() || new Date() };
      });
      setLogs(fetchedLogs);

      // Extract unique exercises done
      const exIds = new Set<string>();
      fetchedLogs.forEach((log: any) => {
        log.exerciciosExecutados?.forEach((e: any) => exIds.add(e.exerciseId));
      });

      // Fetch Names for those
      const meta: Record<string, string> = {};
      for (const id of Array.from(exIds)) {
        const eq = query(collection(db, 'exercises'), where('exerciseId', '==', id));
        const eSnap = await getDocs(eq);
        if(!eSnap.empty) {
          meta[id] = eSnap.docs[0].data().nome;
        }
      }
      setExercisesMeta(meta);

      if (exIds.size > 0 && !selectedEx) {
         setSelectedEx(Array.from(exIds)[0]);
      }

      // Fetch Photos
      const qPhotos = query(collection(db, 'progressPhotos'), where('clientId', '==', userData.uid), orderBy('data', 'asc'));
      const pSnap = await getDocs(qPhotos);
      const fetchedPhotos = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPhotos(fetchedPhotos);
    };
    fetchProgress();
  }, [userData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file || !userData?.uid) return;

     if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("A foto deve ter no máximo 5MB");
        return;
     }

     setIsUploading(true);
     try {
       const timestamp = Date.now();
       const storageRef = ref(storage, `progress_photos/${userData.uid}/${timestamp}_${file.name}`);
       const uploadTask = await uploadBytesResumable(storageRef, file);
       const downloadURL = await getDownloadURL(uploadTask.ref);

       const novoDoc = {
          clientId: userData.uid,
          url: downloadURL,
          data: serverTimestamp()
       };

       const docRef = await addDoc(collection(db, 'progressPhotos'), novoDoc);
       
       // Update UI optimistic
       setPhotos([...photos, { id: docRef.id, url: downloadURL, data: { toDate: () => new Date() } }]);
       toast.success("Foto salva no seu cofre!");
     } catch (error) {
       console.error("Erro no upload", error);
       toast.error("Ocorreu um erro no upload. Verifique as configurações de Storage no painel Firebase.");
     } finally {
       setIsUploading(false);
     }
  };

  const generateChartData = () => {
    const dataPoints: { date: string; maxCarga: number }[] = [];

    logs.forEach(log => {
      const ex = log.exerciciosExecutados?.find((e: any) => e.exerciseId === selectedEx);
      if (ex && ex.series) {
        let maxCarga = 0;
        ex.series.forEach((s: any) => {
           if (s.carga > maxCarga) maxCarga = s.carga;
        });
        if (maxCarga > 0) {
           dataPoints.push({
             date: format(log.date, 'dd/MM/yyyy'),
             maxCarga
           });
        }
      }
    });

    return {
      labels: dataPoints.map(d => d.date),
      datasets: [
        {
          label: 'Carga Máxima (kg)',
          data: dataPoints.map(d => d.maxCarga),
          borderColor: '#D4A947',
          backgroundColor: 'rgba(212, 169, 71, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#0D0D0D',
          pointBorderColor: '#D4A947',
          pointHoverBackgroundColor: '#D4A947',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1A1A1A',
        titleColor: '#F0EDE6',
        bodyColor: '#8A8A7A',
        borderColor: '#333333',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx: any) => `Carga Máx: ${ctx.raw} kg`
        }
      }
    },
    scales: {
      x: { grid: { color: '#252525', drawBorder: false }, ticks: { color: '#8A8A7A' } },
      y: { grid: { color: '#252525', drawBorder: false }, ticks: { color: '#8A8A7A', stepSize: 5 } }
    }
  };

  const exListKeys = Object.keys(exercisesMeta);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      
      {/* HEADER E TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-[#D4A947]" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-[#F0EDE6]">Evolução</h1>
            <p className="text-[#8A8A7A]">Acompanhe suas métricas e estética</p>
          </div>
        </div>

        <div className="flex bg-[#0D0D0D] rounded-xl p-1 border border-[#333333] w-fit">
           <button 
             onClick={() => setActiveTab('charts')}
             className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'charts' ? 'bg-[#1A1A1A] text-[#D4A947] shadow-sm' : 'text-[#8A8A7A] hover:text-[#F0EDE6]'}`}
           >
              Força Atual
           </button>
           <button 
             onClick={() => setActiveTab('photos')}
             className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'photos' ? 'bg-[#1A1A1A] text-[#D4A947] shadow-sm' : 'text-[#8A8A7A] hover:text-[#F0EDE6]'}`}
           >
              Galeria (Mosaico)
           </button>
        </div>
      </div>

      {activeTab === 'charts' ? (
        <Card className="flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex justify-between items-end gap-4">
          <div className="w-full max-w-sm">
            <label className="text-sm font-medium text-[#8A8A7A] mb-2 block">Selecione o Exercício</label>
            <select 
              className="w-full bg-[#0D0D0D] border border-[#333333] rounded-lg h-12 px-4 font-medium text-[#F0EDE6] focus:ring-2 focus:ring-[#D4A947] outline-none"
              value={selectedEx}
              onChange={(e) => setSelectedEx(e.target.value)}
            >
              {exListKeys.length === 0 && <option value="">Nenhum dado regitrado ainda</option>}
              {exListKeys.map(k => (
                <option key={k} value={k}>{exercisesMeta[k]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-80 w-full mt-4 bg-[#0D0D0D] border border-[#333333] rounded-xl p-4">
          {exListKeys.length > 0 ? (
            <Line data={generateChartData()} options={chartOptions} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#8A8A7A]">
              <Activity size={40} className="mb-2 opacity-20" />
              <p>Execute treinos para ver seus gráficos de evolução aqui.</p>
            </div>
          )}
        </div>
      </Card>
      ) : (
      <div className="animate-in fade-in slide-in-from-right-8 duration-300">
        <Card className="flex flex-col space-y-6 bg-gradient-to-tr from-[#1A1A1A] to-[#0D0D0D] border-[#333333]">
           
           <div className="flex justify-between items-center bg-[#0D0D0D] p-4 rounded-xl border border-[#333333]">
              <div>
                 <h2 className="text-lg font-bold text-[#F0EDE6] flex items-center gap-2">
                    <ImageIcon className="text-[#D4A947] w-5 h-5" /> Cofre Espelho
                 </h2>
                 <p className="text-sm text-[#8A8A7A]">Suas fotos de progresso (Mês a Mês). Totalmente privativo.</p>
              </div>

              <input 
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload} 
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isUploading}
                className="bg-[#D4A947]/10 text-[#D4A947] hover:bg-[#D4A947]/20 border border-[#D4A947]/30 whitespace-nowrap"
              >
                 {isUploading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Camera className="mr-2 w-5 h-5" /> Adicionar</>}
              </Button>
           </div>

           {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-[#8A8A7A] border border-dashed border-[#333333] rounded-xl bg-[#0D0D0D]/50">
                 <Camera size={48} className="mb-4 opacity-20" />
                 <p className="font-medium text-[#F0EDE6]">Você ainda não tem fotos cadastradas</p>
                 <p className="text-sm">Clique em Adicionar para guardar sua foto shape inicial!</p>
              </div>
           ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {photos.map((photo, i) => (
                    <div key={photo.id} className="relative aspect-[3/4] group rounded-xl overflow-hidden bg-[#0D0D0D] border border-[#333333]">
                       <img src={photo.url} alt="Progresso" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                       <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 pt-8 pb-3 px-3 flex justify-between items-end">
                          <p className="text-xs font-bold text-[#D4A947] uppercase">Mês {i + 1}</p>
                          <p className="text-[10px] items-center flex gap-1 font-semibold text-[#F0EDE6]">
                             <Calendar size={10} /> {photo.data?.toDate ? format(photo.data.toDate(), 'dd/MMM') : 'Hoje'}
                          </p>
                       </div>
                    </div>
                 ))}
              </div>
           )}

        </Card>
      </div>
      )}
    </div>
  );
};

export default ProgressCharts;

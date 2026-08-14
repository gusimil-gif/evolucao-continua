import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../services/firebaseConfig';
import { exercisesData } from './exercisesData';
import { quotesData } from './quotesData';
import type { UserData } from '../types';

export const runSeed = async () => {
  try {
    console.log("Iniciando Seed Data Evolução Contínua...");

    // 1. Criar ou Recuperar Trainer (Lázaro Timóteo)
    let trainerUid = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, 'lazaro@evolucaocontinua.app', 'EC2026!');
      trainerUid = userCredential.user.uid;
      console.log("Usuário Master Trainer criado na Autenticação.");
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log("Usuário Trainer já existe na Auth. Tentando login para recuperar UID...");
        const loginCredential = await signInWithEmailAndPassword(auth, 'lazaro@evolucaocontinua.app', 'EC2026!');
        trainerUid = loginCredential.user.uid;
      } else {
        console.error("Erro ao configurar na Auth:", error);
        throw error;
      }
    }

    if (trainerUid) {
       const trainerData: UserData = {
          uid: trainerUid,
          userType: 'trainer',
          nome: 'Lázaro Timóteo',
          dataNascimento: '1990-01-01',
          email: 'lazaro@evolucaocontinua.app',
          telefone: '+5591999999999',
          dataCriacao: new Date(),
          ultimoAcesso: new Date(),
          ativo: true
       };
       await setDoc(doc(db, 'users', trainerUid), trainerData);
       console.log("Documento do Firestore para o Trainer garantido com sucesso.");
    }

    // 2. Verificar/Popular/Atualizar Exercícios
    const exercisesRef = collection(db, 'exercises');
    const existingExSnapshot = await getDocs(exercisesRef);
    
    if (existingExSnapshot.empty) {
      console.log(`Populando ${exercisesData.length} exercícios...`);
      for (const ex of exercisesData) {
        const docRef = doc(exercisesRef);
        await setDoc(docRef, {
          ...ex,
          exerciseId: docRef.id
        });
      }
      console.log("Exercícios criados com sucesso.");
    } else {
      console.log(`Exercícios já existem (${existingExSnapshot.size} encontrados). Atualizando links de vídeo...`);
      const existingDocs = existingExSnapshot.docs;
      for (const ex of exercisesData) {
        const docMatch = existingDocs.find(d => d.data().nome === ex.nome);
        if (docMatch) {
          // Atualizar o link de vídeo para garantir coerência
          await setDoc(doc(db, 'exercises', docMatch.id), {
            ...docMatch.data(),
            videoUrl: ex.videoUrl,
            videoUrlPadrao: ex.videoUrlPadrao
          }, { merge: true });
        } else {
          // Criar se não existir
          const docRef = doc(exercisesRef);
          await setDoc(docRef, {
            ...ex,
            exerciseId: docRef.id
          });
        }
      }
      console.log("Links de vídeo dos exercícios atualizados com sucesso no Firestore.");
    }

    // 3. Verificar/Popular Frases Motivacionais
    const quotesRef = collection(db, 'motivationalQuotes');
    const existingQuotesSnapshot = await getDocs(quotesRef);
    if (existingQuotesSnapshot.empty) {
      console.log(`Populando ${quotesData.length} frases motivacionais...`);
      for (let i = 0; i < quotesData.length; i++) {
        const docRef = doc(quotesRef);
        await setDoc(docRef, {
          quoteId: docRef.id,
          texto: quotesData[i],
          ativo: true,
          ordem: i + 1
        });
      }
      console.log("Frases criadas com sucesso.");
    } else {
      console.log(`Frases motivacionais já existem (${existingQuotesSnapshot.size} encontradas).`);
    }

    console.log("Seed finalizado com sucesso!");
    return true;
  } catch (error) {
    console.error("Erro geral no Seed:", error);
    throw error;
  }
};

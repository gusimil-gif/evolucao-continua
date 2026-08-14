import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import toast from 'react-hot-toast';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O RootRedirect ou ProtectedRoute cuidará do roteamento na Home/Auth.
      navigate('/');
    } catch (error: any) {
      toast.error('Email ou senha incorretos. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-4 text-[#F0EDE6]">
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700" elevated>
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" />
          <p className="text-[#8A8A7A] text-sm mt-3 font-medium uppercase tracking-widest">Corpo • Mente • Disciplina • Resultados</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            label="Email"
            type="email" 
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Senha"
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <Button type="submit" className="w-full mt-2" isLoading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-[#8A8A7A]">
          Não possui conta? {' '}
          <Link to="/register" className="text-[#D4A947] hover:underline">
            Cadastre-se como aluno
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;

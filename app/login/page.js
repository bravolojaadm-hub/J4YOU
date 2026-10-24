'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro('E-mail ou senha incorretos.');
      setCarregando(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fdfbf7',
      fontFamily: 'Poppins, system-ui, sans-serif',
      padding: '20px'
    }}>
      <form onSubmit={entrar} style={{
        background: '#fff',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(17,59,39,0.10)',
        width: '100%',
        maxWidth: '400px',
        borderTop: '6px solid #ff65c7'
      }}>
        <h1 style={{
          color: '#113b27',
          fontSize: '28px',
          marginBottom: '8px',
          textAlign: 'center'
        }}>J4Y 💖</h1>
        <p style={{
          color: '#750035',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '28px'
        }}>Entre para acessar seu painel</p>

        <label style={{ display: 'block', color: '#113b27', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
          E-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '2px solid #c999e3',
            marginBottom: '16px',
            fontSize: '15px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        <label style={{ display: 'block', color: '#113b27', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
          Senha
        </label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '2px solid #c999e3',
            marginBottom: '20px',
            fontSize: '15px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        {erro && (
          <p style={{ color: '#750035', fontSize: '13px', marginBottom: '14px', textAlign: 'center' }}>
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: '#ff65c7',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 700,
            cursor: carregando ? 'wait' : 'pointer',
            opacity: carregando ? 0.7 : 1
          }}
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

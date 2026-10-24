'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [modo, setModo] = useState('login'); // 'login' | 'cadastro'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function limparMensagens() {
    setErro('');
    setSucesso('');
  }

  function trocarModo(novoModo) {
    setModo(novoModo);
    limparMensagens();
    setSenha('');
    setConfirmaSenha('');
  }

  async function entrar(e) {
    e.preventDefault();
    limparMensagens();
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

  async function cadastrar(e) {
    e.preventDefault();
    limparMensagens();

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmaSenha) {
      setErro('As senhas não conferem.');
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        setErro('Este e-mail já está cadastrado. Faça login.');
      } else {
        setErro('Erro ao criar conta: ' + error.message);
      }
      setCarregando(false);
      return;
    }

    // Se o Supabase exigir confirmação de e-mail, não há sessão ainda
    if (!data.session) {
      setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setCarregando(false);
      setModo('login');
      setSenha('');
      setConfirmaSenha('');
      return;
    }

    router.push('/');
    router.refresh();
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '2px solid #c999e3',
    marginBottom: '16px',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block',
    color: '#113b27',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '6px',
  };

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
      <div style={{
        background: '#fff',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(17,59,39,0.10)',
        width: '100%',
        maxWidth: '420px',
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
          marginBottom: '24px'
        }}>
          {modo === 'login' ? 'Entre para acessar seu painel' : 'Crie sua conta para começar'}
        </p>

        {/* ABAS */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          background: '#fdfbf7',
          padding: '6px',
          borderRadius: '12px'
        }}>
          <button
            type="button"
            onClick={() => trocarModo('login')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: modo === 'login' ? '#ff65c7' : 'transparent',
              color: modo === 'login' ? '#fff' : '#113b27',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => trocarModo('cadastro')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: modo === 'cadastro' ? '#ff65c7' : 'transparent',
              color: modo === 'cadastro' ? '#fff' : '#113b27',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={modo === 'login' ? entrar : cadastrar}>
          <label style={labelStyle}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="seu@email.com"
            style={inputStyle}
          />

          <label style={labelStyle}>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            placeholder="Mínimo 6 caracteres"
            style={inputStyle}
          />

          {modo === 'cadastro' && (
            <>
              <label style={labelStyle}>Confirmar senha</label>
              <input
                type="password"
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                required
                placeholder="Repita a senha"
                style={inputStyle}
              />
            </>
          )}

          {erro && (
            <p style={{
              color: '#750035',
              fontSize: '13px',
              marginBottom: '14px',
              textAlign: 'center',
              background: 'rgba(117,0,53,0.08)',
              padding: '10px',
              borderRadius: '8px'
            }}>
              {erro}
            </p>
          )}

          {sucesso && (
            <p style={{
              color: '#113b27',
              fontSize: '13px',
              marginBottom: '14px',
              textAlign: 'center',
              background: 'rgba(17,59,39,0.08)',
              padding: '10px',
              borderRadius: '8px'
            }}>
              {sucesso}
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
              opacity: carregando ? 0.7 : 1,
              fontFamily: 'inherit'
            }}
          >
            {carregando
              ? (modo === 'login' ? 'Entrando...' : 'Criando conta...')
              : (modo === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#750035',
          marginTop: '20px'
        }}>
          {modo === 'login' ? (
            <>
              Não tem conta?{' '}
              <button
                type="button"
                onClick={() => trocarModo('cadastro')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff65c7',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0,
                  fontFamily: 'inherit'
                }}
              >
                Cadastre-se
              </button>
            </>
          ) : (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                onClick={() => trocarModo('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff65c7',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: 0,
                  fontFamily: 'inherit'
                }}
              >
                Entrar
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

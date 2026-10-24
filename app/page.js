'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function verificar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setCarregando(false);
    }
    verificar();
  }, []);

  if (carregando) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fdfbf7',
        fontFamily: 'Poppins, system-ui, sans-serif',
        color: '#113b27',
        fontSize: '18px'
      }}>
        Carregando... 💖
      </div>
    );
  }

  return (
    <iframe
      src="/app.html"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block'
      }}
      title="J4Y Painel"
    />
  );
}

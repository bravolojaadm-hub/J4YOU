'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const PLATAFORMAS = [
  { id: 'tiktok', nome: 'TikTok Shop', cor: '#113b27', texto: '#fff' },
  { id: 'ml', nome: 'Mercado Livre', cor: '#f6d98b', texto: '#113b27' },
  { id: 'shopee', nome: 'Shopee', cor: '#ff4e16', texto: '#fff' },
  { id: 'kwai', nome: 'Kwai Shop', cor: '#c999e3', texto: '#fff' },
];

const TAXAS_PADRAO = {
  tiktok_pct_menor: 0.10, tiktok_pct_maior: 0.06,
  tiktok_fixo_menor: 4.00, tiktok_fixo_maior: 6.00,
  tiktok_sfp: 0.06, ml_comissao: 0.15, ml_frete: 12.00,
  shopee_pct: 0.20, shopee_fixo: 4.50,
  kwai_pct: 0.20, kwai_fixo: 4.00,
};

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) || n < 0 ? 0 : n;
}

function brl(v) {
  return 'R$ ' + (v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function pct(v) {
  return ((v || 0) * 100).toFixed(1).replace('.', ',') + '%';
}

function custoMaterias(produto) {
  const mps = produto.materias_primas || [];
  return mps.reduce((s, m) => s + num(m.valor) * num(m.qtd), 0);
}

function custoTotal(produto) {
  return custoMaterias(produto) + num(produto.custo_embalagem) + num(produto.outros_custos);
}

function calcTaxa(plataforma, preco, taxas) {
  const p = num(preco);
  if (plataforma === 'tiktok') {
    const base = p < 50
      ? p * num(taxas.tiktok_pct_menor) + num(taxas.tiktok_fixo_menor)
      : p * num(taxas.tiktok_pct_maior) + num(taxas.tiktok_fixo_maior);
    return base + p * num(taxas.tiktok_sfp);
  }
  if (plataforma === 'ml') return p * num(taxas.ml_comissao) + num(taxas.ml_frete);
  if (plataforma === 'shopee') return p * num(taxas.shopee_pct) + num(taxas.shopee_fixo);
  if (plataforma === 'kwai') return p * num(taxas.kwai_pct) + num(taxas.kwai_fixo);
  return 0;
}

export default function Painel() {
  const [aba, setAba] = useState('dashboard');
  const [produtos, setProdutos] = useState([]);
  const [promocoes, setPromocoes] = useState([]);
  const [taxas, setTaxas] = useState(TAXAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [user, setUser] = useState(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      await carregarTudo(user.id);
      setCarregando(false);
    }
    init();
  }, []);

  async function carregarTudo(uid) {
    const [p, pr, t] = await Promise.all([
      supabase.from('produtos').select('*').order('criado_em'),
      supabase.from('promocoes').select('*').order('criado_em'),
      supabase.from('taxas').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setProdutos(p.data || []);
    setPromocoes(pr.data || []);
    if (t.data) setTaxas({ ...TAXAS_PADRAO, ...t.data });
  }

  function aviso(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function salvarProduto(produto) {
    const payload = {
      user_id: user.id,
      nome: produto.nome,
      foto_url: produto.foto_url || null,
      preco_venda: num(produto.preco_venda),
      custo_embalagem: num(produto.custo_embalagem),
      outros_custos: num(produto.outros_custos),
      materias_primas: produto.materias_primas || [],
      atualizado_em: new Date().toISOString(),
    };

    if (produto.id) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', produto.id);
      if (error) { aviso('Erro ao salvar: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('produtos').insert(payload);
      if (error) { aviso('Erro ao salvar: ' + error.message); return; }
    }
    await carregarTudo(user.id);
    setModal(null);
    aviso('Produto salvo! 💖');
  }

  async function excluirProduto(id) {
    if (!confirm('Excluir este produto?')) return;
    await supabase.from('produtos').delete().eq('id', id);
    await carregarTudo(user.id);
    aviso('Produto excluído.');
  }

  async function salvarTaxas(novas) {
    const payload = { user_id: user.id, ...novas, atualizado_em: new Date().toISOString() };
    const { error } = await supabase.from('taxas').upsert(payload, { onConflict: 'user_id' });
    if (error) { aviso('Erro: ' + error.message); return; }
    setTaxas(novas);
    aviso('Taxas atualizadas!');
  }

  async function salvarPromocao(promo) {
    const payload = { user_id: user.id, ...promo };
    const { error } = await supabase.from('promocoes').insert(payload);
    if (error) { aviso('Erro: ' + error.message); return; }
    await carregarTudo(user.id);
    setModal(null);
    aviso('Promoção registrada!');
  }

  async function excluirPromocao(id) {
    if (!confirm('Excluir esta promoção?')) return;
    await supabase.from('promocoes').delete().eq('id', id);
    await carregarTudo(user.id);
    aviso('Promoção excluída.');
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function exportarBackup() {
    const dados = {
      app: 'J4Y', versao: '1.0',
      dataExportacao: new Date().toISOString(),
      dataFormatada: new Date().toLocaleString('pt-BR'),
      resumo: { produtos: produtos.length, promocoes: promocoes.length, taxas: 1 },
      dados: { produtos, promocoes, taxas },
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const nome = `j4y-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.json`;
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
    aviso('Backup baixado! 💾');
  }

  async function importarBackup(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const json = JSON.parse(texto);
      if (json.app !== 'J4Y') { aviso('Arquivo inválido.'); return; }
      if (!confirm(`Restaurar backup de ${json.dataFormatada}?\n\nIsso substituirá TODOS os dados atuais.`)) return;

      await supabase.from('produtos').delete().eq('user_id', user.id);
      await supabase.from('promocoes').delete().eq('user_id', user.id);

      const prods = (json.dados?.produtos || []).map(p => ({
        user_id: user.id, nome: p.nome, foto_url: p.foto_url,
        preco_venda: num(p.preco_venda), custo_embalagem: num(p.custo_embalagem),
        outros_custos: num(p.outros_custos), materias_primas: p.materias_primas || [],
      }));
      if (prods.length) await supabase.from('produtos').insert(prods);

      const promos = (json.dados?.promocoes || []).map(p => ({
        user_id: user.id, mes: p.mes, produto: p.produto, plataforma: p.plataforma,
        preco_normal: num(p.preco_normal), preco_promocional: num(p.preco_promocional),
        data_inicio: p.data_inicio, data_fim: p.data_fim, observacoes: p.observacoes,
      }));
      if (promos.length) await supabase.from('promocoes').insert(promos);

      if (json.dados?.taxas) await salvarTaxas({ ...TAXAS_PADRAO, ...json.dados.taxas });

      await carregarTudo(user.id);
      aviso('Backup restaurado! ✅');
    } catch (err) {
      aviso('Erro ao ler o arquivo.');
    }
  }

  if (carregando) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#113b27' }}>Carregando... 💖</div>;
  }

  const totalCusto = produtos.reduce((s, p) => s + custoTotal(p), 0);
  const totalPreco = produtos.reduce((s, p) => s + num(p.preco_venda), 0);
  const custoMedio = produtos.length ? totalCusto / produtos.length : 0;
  const precoMedio = produtos.length ? totalPreco / produtos.length : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fdfbf7' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 230, background: '#113b27', padding: '24px 16px',
        display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0
      }}>
        <h1 style={{ color: '#fff', fontSize: 22, marginBottom: 20, paddingLeft: 8 }}>J4Y 💖</h1>
        {[
          ['dashboard', '📊 Dashboard'],
          ['precificacao', '💖 Precificação'],
          ['produtos', '📦 Produtos'],
          ['promocoes', '🏷️ Promoções'],
          ['backup', '💾 Backup'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            background: aba === id ? '#ff65c7' : 'transparent',
            color: '#fff', border: 'none', padding: '12px 14px',
            borderRadius: 10, textAlign: 'left', cursor: 'pointer',
            fontSize: 14, fontWeight: aba === id ? 700 : 500,
          }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={sair} style={{
          background: 'transparent', color: '#c999e3', border: '1px solid #c999e3',
          padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13
        }}>Sair</button>
      </aside>

      {/* CONTEÚDO */}
      <main style={{ flex: 1, padding: 28, overflow: 'auto' }}>
        {aba === 'dashboard' && (
          <>
            <h2 style={{ color: '#113b27', fontSize: 26, marginBottom: 20 }}>Olá! 💖</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 28 }}>
              {[
                ['TOTAL DE PRODUTOS', produtos.length, '#ff65c7', ''],
                ['CUSTO MÉDIO', brl(custoMedio), '#c999e3', ''],
                ['PREÇO MÉDIO', brl(precoMedio), '#a5cff9', ''],
                ['LUCRO MÉDIO', brl(precoMedio - custoMedio), '#f6d98b', ''],
              ].map(([label, valor, cor], i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: 16, padding: 20,
                  borderTop: `5px solid ${cor}`, boxShadow: '0 4px 16px rgba(17,59,39,0.08)'
                }}>
                  <div style={{ fontSize: 11, color: '#750035', fontWeight: 700, marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, color: '#113b27', fontWeight: 700 }}>{valor}</div>
                </div>
              ))}
            </div>

            <h3 style={{ color: '#113b27', marginBottom: 14 }}>🌸 Lucro por Plataforma</h3>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
              {PLATAFORMAS.map(pl => {
                const lucros = produtos.map(p => num(p.preco_venda) - custoTotal(p) - calcTaxa(pl.id, p.preco_venda, taxas));
                const media = lucros.length ? lucros.reduce((a, b) => a + b, 0) / lucros.length : 0;
                return (
                  <div key={pl.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0ece4' }}>
                    <span style={{ color: '#113b27', fontWeight: 600 }}>{pl.nome}</span>
                    <span style={{ color: media < 0 ? '#750035' : '#113b27', fontWeight: 700 }}>{brl(media)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aba === 'precificacao' && (
          <>
            <h2 style={{ color: '#113b27', fontSize: 26, marginBottom: 20 }}>💖 Precificação</h2>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
              <h3 style={{ color: '#113b27', fontSize: 15, marginBottom: 14 }}>⚙️ Taxas editáveis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                {[
                  ['tiktok_pct_menor', 'TikTok % (<50)'],
                  ['tiktok_pct_maior', 'TikTok % (>=50)'],
                  ['tiktok_fixo_menor', 'TikTok Fixo (<50)'],
                  ['tiktok_fixo_maior', 'TikTok Fixo (>=50)'],
                  ['tiktok_sfp', 'TikTok SFP %'],
                  ['ml_comissao', 'ML Comissão %'],
                  ['ml_frete', 'ML Frete R$'],
                  ['shopee_pct', 'Shopee %'],
                  ['shopee_fixo', 'Shopee Fixo'],
                  ['kwai_pct', 'Kwai %'],
                  ['kwai_fixo', 'Kwai Fixo'],
                ].map(([k, label]) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, color: '#750035', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={taxas[k]}
                      onChange={e => setTaxas({ ...taxas, [k]: num(e.target.value) })}
                      onBlur={() => salvarTaxas(taxas)}
                      style={{ width: '100%', padding: 8, borderRadius: 8, border: '2px solid #c999e3', fontSize: 13 }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, padding: 20, overflowX: 'auto', boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#113b27', color: '#fff' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>PRODUTO</th>
                    <th style={{ padding: 10 }}>CUSTO</th>
                    <th style={{ padding: 10 }}>PREÇO</th>
                    {PLATAFORMAS.map(pl => (
                      <th key={pl.id} style={{ padding: 10 }}>{pl.nome.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {produtos.map(p => {
                    const ct = custoTotal(p);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f0ece4' }}>
                        <td style={{ padding: 10, fontWeight: 600 }}>{p.nome}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{brl(ct)}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{brl(p.preco_venda)}</td>
                        {PLATAFORMAS.map(pl => {
                          const lucro = num(p.preco_venda) - ct - calcTaxa(pl.id, p.preco_venda, taxas);
                          return (
                            <td key={pl.id} style={{
                              padding: 10, textAlign: 'center', fontWeight: 700,
                              color: lucro < 0 ? '#750035' : '#113b27',
                              background: lucro < 0 ? 'rgba(117,0,53,0.08)' : 'transparent'
                            }}>{brl(lucro)}</td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {aba === 'produtos' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#113b27', fontSize: 26 }}>📦 Produtos</h2>
              <button onClick={() => setModal({ tipo: 'produto', dados: { nome: '', preco_venda: '', custo_embalagem: '', outros_custos: '', materias_primas: [{ material: '', valor: '', qtd: '' }] } })} style={{
                background: '#ff65c7', color: '#fff', border: 'none', padding: '12px 20px',
                borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14
              }}>+ Adicionar produto</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
              {produtos.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
                  <div style={{ height: 140, background: 'linear-gradient(135deg,#ff65c7,#c999e3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.foto_url
                      ? <img src={p.foto_url} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 40 }}>📦</span>}
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, color: '#113b27', marginBottom: 8 }}>{p.nome}</div>
                    <div style={{ fontSize: 12, color: '#750035', marginBottom: 4 }}>Custo: {brl(custoTotal(p))}</div>
                    <div style={{ fontSize: 12, color: '#113b27', marginBottom: 12 }}>Preço: {brl(p.preco_venda)}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setModal({ tipo: 'produto', dados: p })} style={{
                        flex: 1, background: '#c999e3', color: '#fff', border: 'none',
                        padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600
                      }}>Editar</button>
                      <button onClick={() => excluirProduto(p.id)} style={{
                        background: '#ff4e16', color: '#fff', border: 'none',
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12
                      }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {aba === 'promocoes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#113b27', fontSize: 26 }}>🏷️ Promoções</h2>
              <button onClick={() => setModal({ tipo: 'promocao', dados: { mes: '', produto: '', plataforma: '', preco_normal: '', preco_promocional: '', data_inicio: '', data_fim: '', observacoes: '' } })} style={{
                background: '#ff65c7', color: '#fff', border: 'none', padding: '12px 20px',
                borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 14
              }}>+ Nova promoção</button>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, overflowX: 'auto', boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#113b27', color: '#fff' }}>
                    {['MÊS','PRODUTO','PLATAFORMA','PREÇO NORMAL','PROMO','DESCONTO','INÍCIO','FIM',''].map(h => (
                      <th key={h} style={{ padding: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promocoes.map(p => {
                    const desc = num(p.preco_normal) > 0 ? (num(p.preco_normal) - num(p.preco_promocional)) / num(p.preco_normal) : 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f0ece4' }}>
                        <td style={{ padding: 10 }}>{p.mes}</td>
                        <td style={{ padding: 10, fontWeight: 600 }}>{p.produto}</td>
                        <td style={{ padding: 10 }}>{p.plataforma}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{brl(p.preco_normal)}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{brl(p.preco_promocional)}</td>
                        <td style={{ padding: 10, textAlign: 'center', fontWeight: 700, color: '#750035' }}>{pct(desc)}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{p.data_inicio || '—'}</td>
                        <td style={{ padding: 10, textAlign: 'center' }}>{p.data_fim || '—'}</td>
                        <td style={{ padding: 10 }}>
                          <button onClick={() => excluirPromocao(p.id)} style={{
                            background: '#ff4e16', color: '#fff', border: 'none',
                            padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11
                          }}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {aba === 'backup' && (
          <>
            <h2 style={{ color: '#113b27', fontSize: 26, marginBottom: 20 }}>💾 Backup</h2>
            <div style={{ display: 'grid', gap: 16, maxWidth: 700 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
                <h3 style={{ color: '#113b27', marginBottom: 8 }}>Exportar backup completo</h3>
                <p style={{ color: '#750035', fontSize: 13, marginBottom: 16 }}>
                  {produtos.length} produtos · {promocoes.length} promoções · taxas salvas
                </p>
                <button onClick={exportarBackup} style={{
                  background: '#ff65c7', color: '#fff', border: 'none', padding: '14px 24px',
                  borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 15
                }}>⬇️ Baixar backup (.json)</button>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 16px rgba(17,59,39,0.08)' }}>
                <h3 style={{ color: '#113b27', marginBottom: 8 }}>Restaurar de um backup</h3>
                <p style={{ color: '#750035', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ Todos os dados atuais serão substituídos por este backup.
                </p>
                <input type="file" accept=".json" onChange={importarBackup} style={{ fontSize: 13 }} />
              </div>
            </div>
          </>
        )}
      </main>

      {/* MODAL */}
      {modal && (
        <ModalProduto
          modal={modal}
          produtos={produtos}
          onClose={() => setModal(null)}
          onSalvarProduto={salvarProduto}
          onSalvarPromocao={salvarPromocao}
          supabase={supabase}
          user={user}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: '#113b27', color: '#fff',
          padding: '14px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(17,59,39,0.25)', zIndex: 1000
        }}>{toast}</div>
      )}
    </div>
  );
}

function ModalProduto({ modal, produtos, onClose, onSalvarProduto, onSalvarPromocao, supabase, user }) {
  const [dados, setDados] = useState(modal.dados);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef(null);

  function set(campo, valor) {
    setDados({ ...dados, [campo]: valor });
  }

  function setMP(i, campo, valor) {
    const mps = [...(dados.materias_primas || [])];
    mps[i] = { ...mps[i], [campo]: valor };
    setDados({ ...dados, materias_primas: mps });
  }

  function addMP() {
    setDados({ ...dados, materias_primas: [...(dados.materias_primas || []), { material: '', valor: '', qtd: '' }] });
  }

  function removeMP(i) {
    setDados({ ...dados, materias_primas: dados.materias_primas.filter((_, idx) => idx !== i) });
  }

  async function uploadFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('produtos').upload(path, file);
    if (error) { alert('Erro no upload: ' + error.message); return; }
    const { data } = supabase.storage.from('produtos').getPublicUrl(path);
    set('foto_url', data.publicUrl);
  }

  async function salvar() {
    setEnviando(true);
    if (modal.tipo === 'produto') await onSalvarProduto(dados);
    else await onSalvarPromocao(dados);
    setEnviando(false);
  }

  const custoMP = (dados.materias_primas || []).reduce((s, m) => s + num(m.valor) * num(m.qtd), 0);
  const custoT = custoMP + num(dados.custo_embalagem) + num(dados.outros_custos);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,59,39,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 999
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 620,
        maxHeight: '90vh', overflow: 'auto', borderTop: '6px solid #ff65c7'
      }}>
        <h3 style={{ color: '#113b27', marginBottom: 20 }}>
          {modal.tipo === 'produto' ? (dados.id ? 'Editar produto' : 'Novo produto') : 'Nova promoção'}
        </h3>

        {modal.tipo === 'produto' ? (
          <>
            <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Nome do produto</label>
            <input value={dados.nome || ''} onChange={e => set('nome', e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginBottom: 14, marginTop: 4 }} />

            <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Foto do produto</label>
            <div style={{ marginBottom: 14, marginTop: 4 }}>
              {dados.foto_url && <img src={dados.foto_url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
              <input ref={fileRef} type="file" accept="image/*" onChange={uploadFoto} style={{ fontSize: 12 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Preço de venda</label>
                <input type="number" step="0.01" min="0" value={dados.preco_venda || ''} onChange={e => set('preco_venda', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Embalagem</label>
                <input type="number" step="0.01" min="0" value={dados.custo_embalagem || ''} onChange={e => set('custo_embalagem', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Outros custos</label>
                <input type="number" step="0.01" min="0" value={dados.outros_custos || ''} onChange={e => set('outros_custos', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
            </div>

            <h4 style={{ color: '#113b27', fontSize: 14, marginBottom: 10 }}>🧵 Matérias-primas</h4>
            {(dados.materias_primas || []).map((m, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                <input placeholder="Material" value={m.material || ''} onChange={e => setMP(i, 'material', e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '2px solid #c999e3', fontSize: 13 }} />
                <input type="number" step="0.01" min="0" placeholder="Valor" value={m.valor || ''} onChange={e => setMP(i, 'valor', e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '2px solid #c999e3', fontSize: 13 }} />
                <input type="number" step="0.01" min="0" placeholder="Qtd" value={m.qtd || ''} onChange={e => setMP(i, 'qtd', e.target.value)}
                  style={{ padding: 8, borderRadius: 8, border: '2px solid #c999e3', fontSize: 13 }} />
                <button onClick={() => removeMP(i)} style={{
                  background: '#ff4e16', color: '#fff', border: 'none', borderRadius: 8, padding: '0 10px', cursor: 'pointer'
                }}>🗑️</button>
              </div>
            ))}
            <button onClick={addMP} style={{
              background: '#c999e3', color: '#fff', border: 'none', padding: '8px 14px',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 18
            }}>+ Adicionar material</button>

            <div style={{ background: '#f6d98b', borderRadius: 12, padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Matérias-primas:</span><strong>{brl(custoMP)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>Embalagem:</span><strong>{brl(num(dados.custo_embalagem))}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span>Outros:</span><strong>{brl(num(dados.outros_custos))}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, borderTop: '2px solid #113b27', paddingTop: 8 }}>
                <strong>CUSTO TOTAL:</strong><strong>{brl(custoT)}</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Mês</label>
                <select value={dados.mes || ''} onChange={e => set('mes', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }}>
                  <option value="">Selecione</option>
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Produto</label>
                <select value={dados.produto || ''} onChange={e => set('produto', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }}>
                  <option value="">Selecione</option>
                  {produtos.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Plataforma</label>
              <select value={dados.plataforma || ''} onChange={e => set('plataforma', e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }}>
                <option value="">Selecione</option>
                {PLATAFORMAS.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Preço normal</label>
                <input type="number" step="0.01" min="0" value={dados.preco_normal || ''} onChange={e => set('preco_normal', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Preço promocional</label>
                <input type="number" step="0.01" min="0" value={dados.preco_promocional || ''} onChange={e => set('preco_promocional', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Data início</label>
                <input type="date" value={dados.data_inicio || ''} onChange={e => set('data_inicio', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Data fim</label>
                <input type="date" value={dados.data_fim || ''} onChange={e => set('data_fim', e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4 }} />
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, color: '#750035', fontWeight: 600 }}>Observações</label>
              <textarea value={dados.observacoes || ''} onChange={e => set('observacoes', e.target.value)} rows={2}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '2px solid #c999e3', marginTop: 4, fontFamily: 'inherit' }} />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            background: 'transparent', color: '#c999e3', border: '2px solid #c999e3',
            padding: '12px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 600
          }}>Cancelar</button>
          <button onClick={salvar} disabled={enviando} style={{
            background: '#ff65c7', color: '#fff', border: 'none', padding: '12px 24px',
            borderRadius: 12, cursor: enviando ? 'wait' : 'pointer', fontWeight: 700, opacity: enviando ? 0.7 : 1
          }}>{enviando ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

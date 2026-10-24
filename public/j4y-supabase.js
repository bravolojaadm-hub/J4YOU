/* ============================================================
   J4Y — Camada de persistência Supabase
   Corrige o bug de salvar/editar e sincroniza tudo na nuvem
   ============================================================ */

(function () {
  'use strict';

  const SUPABASE_URL = 'COLE_AQUI_SUA_URL';
  const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_ANON_KEY';

  let sb = null;
  let usuarioAtual = null;
  let pronto = false;

  // ---------- Utilitários ----------
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function toast(msg, tipo) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:99999;
      background:${tipo === 'erro' ? '#750035' : '#113b27'};
      color:#fff;padding:14px 22px;border-radius:12px;
      font-family:Poppins,system-ui,sans-serif;font-size:14px;
      font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- Inicialização ----------
  async function init() {
    if (!window.supabase) {
      console.warn('[J4Y] SDK do Supabase não carregado.');
      return;
    }

    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    usuarioAtual = user;

    await carregarTudo();
    pronto = true;

    // Re-renderiza as telas com os dados da nuvem
    if (typeof window.refreshAllViews === 'function') {
      window.refreshAllViews();
    }
  }

  // ---------- Carregar dados ----------
  async function carregarTudo() {
    const [produtos, promocoes, taxas] = await Promise.all([
      sb.from('produtos').select('*').order('criado_em'),
      sb.from('promocoes').select('*').order('criado_em'),
      sb.from('taxas').select('*').eq('user_id', usuarioAtual.id).maybeSingle(),
    ]);

    if (produtos.data) {
      window.state.products = produtos.data.map(converterProduto);
    }
    if (promocoes.data) {
      window.state.promotions = promocoes.data.map(converterPromocao);
    }
    if (taxas.data) {
      window.state.taxes = { ...window.state.taxes, ...converterTaxas(taxas.data) };
    }
  }

  // ---------- Conversores ----------
  function converterProduto(p) {
    return {
      id: p.id,
      nome: p.nome,
      preco: num(p.preco_venda),
      custoEmbalagem: num(p.custo_embalagem),
      outrosCustos: num(p.outros_custos),
      foto: p.foto_url || null,
      materiasPrimas: (p.materias_primas || []).map(m => ({
        material: m.material || '',
        valorUnitario: num(m.valorUnitario ?? m.valor),
        quantidade: num(m.quantidade ?? m.qtd),
      })),
      platforms: ['tt', 'ml', 'shopee', 'kwai'],
    };
  }

  function converterPromocao(p) {
    return {
      id: p.id,
      mes: p.mes,
      produtoId: p.produto_id,
      prodNome: p.produto,
      precoNormal: num(p.preco_normal),
      precoPromo: num(p.preco_promocional),
      dataInicio: p.data_inicio,
      dataFim: p.data_fim,
      canal: p.plataforma,
      observacoes: p.observacoes,
    };
  }

  function converterTaxas(t) {
    return {
      ttPctMenor: num(t.tiktok_pct_menor),
      ttPctMaior: num(t.tiktok_pct_maior),
      ttFixoMenor: num(t.tiktok_fixo_menor),
      ttFixoMaior: num(t.tiktok_fixo_maior),
      ttSfp: num(t.tiktok_sfp),
      mlComissao: num(t.ml_comissao),
      mlFrete: num(t.ml_frete),
      shopeePct: num(t.shopee_pct),
      shopeeFixo: num(t.shopee_fixo),
      kwaiPct: num(t.kwai_pct),
      kwaiFixo: num(t.kwai_fixo),
    };
  }

  // ---------- Salvar produto (CORRIGIDO) ----------
  window.salvarProdutoSupabase = async function (produto) {
    if (!pronto) {
      toast('Aguarde o carregamento...', 'erro');
      return false;
    }

    const payload = {
      user_id: usuarioAtual.id,
      nome: produto.nome,
      foto_url: produto.foto || null,
      preco_venda: num(produto.preco),
      custo_embalagem: num(produto.custoEmbalagem),
      outros_custos: num(produto.outrosCustos),
      materias_primas: (produto.materiasPrimas || []).map(m => ({
        material: m.material || '',
        valorUnitario: num(m.valorUnitario),
        quantidade: num(m.quantidade),
      })),
      atualizado_em: new Date().toISOString(),
    };

    // ID válido = UUID do Supabase. Qualquer outra coisa = produto novo.
    const ehEdicao = produto.id && String(produto.id).length > 20;

    let erro;
    if (ehEdicao) {
      const r = await sb.from('produtos').update(payload).eq('id', produto.id);
      erro = r.error;
    } else {
      const r = await sb.from('produtos').insert(payload).select().single();
      erro = r.error;
      if (!erro && r.data) produto.id = r.data.id;
    }

    if (erro) {
      toast('Erro ao salvar: ' + erro.message, 'erro');
      return false;
    }

    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Produto salvo! 💖');
    return true;
  };

  // ---------- Excluir produto ----------
  window.excluirProdutoSupabase = async function (id) {
    if (!pronto) return false;
    const { error } = await sb.from('produtos').delete().eq('id', id);
    if (error) {
      toast('Erro ao excluir: ' + error.message, 'erro');
      return false;
    }
    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Produto excluído.');
    return true;
  };

  // ---------- Salvar promoção ----------
  window.salvarPromocaoSupabase = async function (promo) {
    if (!pronto) return false;
    const payload = {
      user_id: usuarioAtual.id,
      mes: promo.mes,
      produto: promo.prodNome,
      plataforma: promo.canal,
      preco_normal: num(promo.precoNormal),
      preco_promocional: num(promo.precoPromo),
      data_inicio: promo.dataInicio || null,
      data_fim: promo.dataFim || null,
      observacoes: promo.observacoes || null,
    };
    const { error } = await sb.from('promocoes').insert(payload);
    if (error) {
      toast('Erro ao salvar promoção: ' + error.message, 'erro');
      return false;
    }
    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Promoção salva!');
    return true;
  };

  // ---------- Salvar taxas ----------
  window.salvarTaxasSupabase = async function (taxas) {
    if (!pronto) return false;
    const payload = {
      user_id: usuarioAtual.id,
      tiktok_pct_menor: num(taxas.ttPctMenor),
      tiktok_pct_maior: num(taxas.ttPctMaior),
      tiktok_fixo_menor: num(taxas.ttFixoMenor),
      tiktok_fixo_maior: num(taxas.ttFixoMaior),
      tiktok_sfp: num(taxas.ttSfp),
      ml_comissao: num(taxas.mlComissao),
      ml_frete: num(taxas.mlFrete),
      shopee_pct: num(taxas.shopeePct),
      shopee_fixo: num(taxas.shopeeFixo),
      kwai_pct: num(taxas.kwaiPct),
      kwai_fixo: num(taxas.kwaiFixo),
      atualizado_em: new Date().toISOString(),
    };
    const { error } = await sb.from('taxas').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast('Erro ao salvar taxas: ' + error.message, 'erro');
      return false;
    }
    return true;
  };

  // ---------- Upload de foto ----------
  window.uploadFotoSupabase = async function (base64) {
    if (!pronto || !base64) return null;
    try {
      const blob = await (await fetch(base64)).blob();
      const ext = blob.type.split('/')[1] || 'png';
      const path = `${usuarioAtual.id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('produtos').upload(path, blob);
      if (error) {
        toast('Erro no upload da foto: ' + error.message, 'erro');
        return null;
      }
      const { data } = sb.storage.from('produtos').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      toast('Erro ao processar a foto.', 'erro');
      return null;
    }
  };

  // ---------- Exportar backup ----------
  window.exportarBackupSupabase = function () {
    const dados = {
      app: 'J4Y',
      versao: '2.0',
      dataExportacao: new Date().toISOString(),
      dataFormatada: new Date().toLocaleString('pt-BR'),
      resumo: {
        produtos: window.state.products.length,
        promocoes: window.state.promotions.length,
        taxas: 1,
      },
      dados: {
        produtos: window.state.products,
        promocoes: window.state.promotions,
        taxas: window.state.taxes,
      },
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `j4y-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup baixado! 💾');
  };

  // ---------- Importar backup ----------
  window.importarBackupSupabase = async function (json) {
    if (!pronto) return false;
    if (!json || json.app !== 'J4Y') {
      toast('Arquivo de backup inválido.', 'erro');
      return false;
    }

    await sb.from('produtos').delete().eq('user_id', usuarioAtual.id);
    await sb.from('promocoes').delete().eq('user_id', usuarioAtual.id);

    const prods = (json.dados?.produtos || []).map(p => ({
      user_id: usuarioAtual.id,
      nome: p.nome,
      foto_url: p.foto || null,
      preco_venda: num(p.preco),
      custo_embalagem: num(p.custoEmbalagem),
      outros_custos: num(p.outrosCustos),
      materias_primas: (p.materiasPrimas || []).map(m => ({
        material: m.material || '',
        valorUnitario: num(m.valorUnitario),
        quantidade: num(m.quantidade),
      })),
    }));
    if (prods.length) await sb.from('produtos').insert(prods);

    const promos = (json.dados?.promocoes || []).map(p => ({
      user_id: usuarioAtual.id,
      mes: p.mes,
      produto: p.prodNome,
      plataforma: p.canal,
      preco_normal: num(p.precoNormal),
      preco_promocional: num(p.precoPromo),
      data_inicio: p.dataInicio || null,
      data_fim: p.dataFim || null,
      observacoes: p.observacoes || null,
    }));
    if (promos.length) await sb.from('promocoes').insert(promos);

    if (json.dados?.taxas) await window.salvarTaxasSupabase(json.dados.taxas);

    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Backup restaurado! ✅');
    return true;
  };

  // ---------- Boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

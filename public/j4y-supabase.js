/* ============================================================
   J4Y — Persistência Supabase (corrige salvar/editar)
   ============================================================ */

(function () {
  'use strict';

  let sb = null;
  let usuarioAtual = null;
  let pronto = false;

  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function toast(msg, tipo) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:' +
      (tipo === 'erro' ? '#750035' : '#113b27') +
      ';color:#fff;padding:14px 22px;border-radius:12px;font-family:Poppins,system-ui,sans-serif;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  async function init() {
    if (!window.supabase) {
      console.warn('[J4Y] SDK do Supabase não carregado.');
      return;
    }

    // Busca as chaves da rota /api/config (variáveis de ambiente da Vercel)
    let cfg;
    try {
      const r = await fetch('/api/config');
      cfg = await r.json();
    } catch (e) {
      console.warn('[J4Y] Não foi possível ler /api/config');
      return;
    }

    if (!cfg.url || !cfg.key) {
      console.warn('[J4Y] Variáveis de ambiente do Supabase ausentes na Vercel.');
      return;
    }

    sb = window.supabase.createClient(cfg.url, cfg.key);

    const res = await sb.auth.getUser();
    const user = res.data && res.data.user;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    usuarioAtual = user;

    await carregarTudo();
    pronto = true;

    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
  }

  async function carregarTudo() {
    const resultados = await Promise.all([
      sb.from('produtos').select('*').order('criado_em'),
      sb.from('promocoes').select('*').order('criado_em'),
      sb.from('taxas').select('*').eq('user_id', usuarioAtual.id).maybeSingle(),
    ]);

    const produtos = resultados[0];
    const promocoes = resultados[1];
    const taxas = resultados[2];

    if (produtos.data && window.state) {
      window.state.products = produtos.data.map(converterProduto);
    }
    if (promocoes.data && window.state) {
      window.state.promotions = promocoes.data.map(converterPromocao);
    }
    if (taxas.data && window.state) {
      window.state.taxes = Object.assign({}, window.state.taxes, converterTaxas(taxas.data));
    }
  }

  function converterProduto(p) {
    return {
      id: p.id,
      nome: p.nome,
      preco: num(p.preco_venda),
      custoEmbalagem: num(p.custo_embalagem),
      outrosCustos: num(p.outros_custos),
      foto: p.foto_url || null,
      materiasPrimas: (p.materias_primas || []).map(function (m) {
        return {
          material: m.material || '',
          valorUnitario: num(m.valorUnitario !== undefined ? m.valorUnitario : m.valor),
          quantidade: num(m.quantidade !== undefined ? m.quantidade : m.qtd),
        };
      }),
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

  // ---------- SALVAR PRODUTO (corrigido) ----------
  window.salvarProdutoSupabase = async function (produto) {
    if (!pronto) { toast('Aguarde o carregamento...', 'erro'); return false; }

    const payload = {
      user_id: usuarioAtual.id,
      nome: produto.nome,
      foto_url: produto.foto || null,
      preco_venda: num(produto.preco),
      custo_embalagem: num(produto.custoEmbalagem),
      outros_custos: num(produto.outrosCustos),
      materias_primas: (produto.materiasPrimas || []).map(function (m) {
        return {
          material: m.material || '',
          valorUnitario: num(m.valorUnitario),
          quantidade: num(m.quantidade),
        };
      }),
      atualizado_em: new Date().toISOString(),
    };

    // UUID do Supabase tem 36 caracteres. Qualquer outro = produto novo.
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

    if (erro) { toast('Erro ao salvar: ' + erro.message, 'erro'); return false; }

    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Produto salvo! 💖');
    return true;
  };

  window.excluirProdutoSupabase = async function (id) {
    if (!pronto) return false;
    const r = await sb.from('produtos').delete().eq('id', id);
    if (r.error) { toast('Erro ao excluir: ' + r.error.message, 'erro'); return false; }
    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Produto excluído.');
    return true;
  };

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
    const r = await sb.from('promocoes').insert(payload);
    if (r.error) { toast('Erro ao salvar promoção: ' + r.error.message, 'erro'); return false; }
    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Promoção salva!');
    return true;
  };

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
    const r = await sb.from('taxas').upsert(payload, { onConflict: 'user_id' });
    if (r.error) { toast('Erro ao salvar taxas: ' + r.error.message, 'erro'); return false; }
    return true;
  };

  window.uploadFotoSupabase = async function (base64) {
    if (!pronto || !base64) return null;
    try {
      const resp = await fetch(base64);
      const blob = await resp.blob();
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const path = usuarioAtual.id + '/' + Date.now() + '.' + ext;
      const up = await sb.storage.from('produtos').upload(path, blob);
      if (up.error) { toast('Erro no upload da foto: ' + up.error.message, 'erro'); return null; }
      const pub = sb.storage.from('produtos').getPublicUrl(path);
      return pub.data.publicUrl;
    } catch (e) {
      toast('Erro ao processar a foto.', 'erro');
      return null;
    }
  };

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
    a.download = 'j4y-backup-' + d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + '-' +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup baixado! 💾');
  };

  window.importarBackupSupabase = async function (json) {
    if (!pronto) return false;
    if (!json || json.app !== 'J4Y') { toast('Arquivo de backup inválido.', 'erro'); return false; }

    await sb.from('produtos').delete().eq('user_id', usuarioAtual.id);
    await sb.from('promocoes').delete().eq('user_id', usuarioAtual.id);

    const prods = (json.dados && json.dados.produtos ? json.dados.produtos : []).map(function (p) {
      return {
        user_id: usuarioAtual.id,
        nome: p.nome,
        foto_url: p.foto || null,
        preco_venda: num(p.preco),
        custo_embalagem: num(p.custoEmbalagem),
        outros_custos: num(p.outrosCustos),
        materias_primas: (p.materiasPrimas || []).map(function (m) {
          return {
            material: m.material || '',
            valorUnitario: num(m.valorUnitario),
            quantidade: num(m.quantidade),
          };
        }),
      };
    });
    if (prods.length) await sb.from('produtos').insert(prods);

    const promos = (json.dados && json.dados.promocoes ? json.dados.promocoes : []).map(function (p) {
      return {
        user_id: usuarioAtual.id,
        mes: p.mes,
        produto: p.prodNome,
        plataforma: p.canal,
        preco_normal: num(p.precoNormal),
        preco_promocional: num(p.precoPromo),
        data_inicio: p.dataInicio || null,
        data_fim: p.dataFim || null,
        observacoes: p.observacoes || null,
      };
    });
    if (promos.length) await sb.from('promocoes').insert(promos);

    if (json.dados && json.dados.taxas) await window.salvarTaxasSupabase(json.dados.taxas);

    await carregarTudo();
    if (typeof window.refreshAllViews === 'function') window.refreshAllViews();
    toast('Backup restaurado! ✅');
    return true;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

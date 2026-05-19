import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  UtensilsCrossed, ShoppingCart, Plus, Minus, Trash2, Search,
  ArrowLeft, CreditCard, CheckCircle2, Clock, Loader2, Copy, RefreshCw,
  ClipboardList, User,
} from 'lucide-react';

const db = supabase as any;

/* ─── types ─── */
interface Produto {
  id: number; xcd_produto: string; xnm_produto: string; xvl_preco_venda: number;
  xurl_foto: string | null; xnm_grupo_produto: string | null;
  xqt_estoque_disponivel: number | null; xlg_venda_online: boolean;
  xdias_venda_online: string | null;
}
interface CartItem { produto: Produto; qty: number }
interface Parametro {
  xnm_escola: string | null; xurl_logo: string | null; xurl_banner_vendas: string | null;
  xmsg_pos_pagamento: string | null; xlg_valida_estoque_link: boolean | null;
  xnm_aba_lojavirtual: string | null;
}
interface PedidoHistorico {
  id: number; xnr_pedido: number; xdt_pedido: string; xvl_total_liquido: number;
  xst_pedido: string; items: { xnm_produto: string; xqt_item: number; xvl_unitario: number; xproduto_id: number }[];
}

type Step = 'identify' | 'menu' | 'cart' | 'payment' | 'done';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABEL: Record<string, string> = { A: 'Aberto', F: 'Finalizado', T: 'Faturado', C: 'Cancelado', P: 'Pago' };

export default function LojaIndex() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [params, setParams] = useState<Parametro | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('identify');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lojaAberta, setLojaAberta] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('cardapio');

  // Customer identification
  const [cpf, setCpf] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [childrenNames, setChildrenNames] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [clienteId, setClienteId] = useState<number | null>(null);

  // Payment
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentPixCode, setPaymentPixCode] = useState('');
  const [paymentQrCodeImage, setPaymentQrCodeImage] = useState('');
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [pedidoNr, setPedidoNr] = useState<number | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  // Order history
  const [historico, setHistorico] = useState<PedidoHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  /* load products & params */
  useEffect(() => {
    const load = async () => {
      const [{ data: prods }, { data: rpcData }] = await Promise.all([
        db.from('vw_produtos_disponiveis')
          .select('id,xcd_produto,xnm_produto,xvl_preco_venda,xurl_foto,xnm_grupo_produto,xqt_estoque_disponivel,xlg_venda_online,xdias_venda_online')
          .eq('xlg_venda_online', true).eq('excluido_visivel', false).order('xnm_produto'),
        db.rpc('fu_get_parametro_publico'),
      ]);
      if (prods) setProdutos(prods);
      if (rpcData?.[0]) setParams(rpcData[0]);

      // Check store schedule using Brazil timezone (America/Sao_Paulo)
      const tz = 'America/Sao_Paulo';
      const partsFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      const parts = partsFmt.formatToParts(new Date()).reduce((a: any, p) => { a[p.type] = p.value; return a; }, {});
      const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const diaSemana = wkMap[parts.weekday] ?? new Date().getDay();
      const { data: horario } = await db.from('parametro_horario')
        .select('*')
        .eq('xdia_semana', diaSemana)
        .eq('excluido_visivel', false)
        .limit(1)
        .single();

      if (!horario || !horario.xlg_dia_ativo) {
        setLojaAberta(false);
      } else {
        const hhmm = `${parts.hour}:${parts.minute}:${parts.second}`;
        const inMatutino = horario.xhr_inicio_matutino && horario.xhr_fim_matutino &&
          hhmm >= horario.xhr_inicio_matutino && hhmm <= horario.xhr_fim_matutino;
        const inVespertino = horario.xhr_inicio_vespertino && horario.xhr_fim_vespertino &&
          hhmm >= horario.xhr_inicio_vespertino && hhmm <= horario.xhr_fim_vespertino;
        setLojaAberta(!!(inMatutino || inVespertino));
      }

      setLoading(false);
    };
    load();
  }, []);

  /* filter products by current weekday (Brazil timezone) */
  const today = (() => {
    const wk = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date());
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[wk] ?? new Date().getDay();
  })();

  const groups = useMemo(
    () => [...new Set(produtos.map(p => p.xnm_grupo_produto).filter(Boolean))] as string[],
    [produtos],
  );

  const filtered = useMemo(() => {
    let list = produtos.filter(p => {
      const dias = (p.xdias_venda_online || '0,1,2,3,4').split(',');
      return dias.includes(String(today));
    });
    if (groupFilter) list = list.filter(p => p.xnm_grupo_produto === groupFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.xnm_produto.toLowerCase().includes(s));
    }
    return list;
  }, [produtos, groupFilter, search, today]);

  const cartTotal = useMemo(() => cart.reduce((sum, ci) => sum + ci.produto.xvl_preco_venda * ci.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, ci) => s + ci.qty, 0), [cart]);

  /* cart helpers */
  const addToCart = (p: Produto) => {
    const validaEstoque = params?.xlg_valida_estoque_link ?? true;
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.produto.id === p.id);
      if (idx >= 0) {
        const newQty = prev[idx].qty + 1;
        if (validaEstoque && p.xqt_estoque_disponivel !== null && newQty > p.xqt_estoque_disponivel) {
          toast({ title: 'Estoque insuficiente', variant: 'destructive' }); return prev;
        }
        return prev.map((ci, i) => (i === idx ? { ...ci, qty: newQty } : ci));
      }
      if (validaEstoque && p.xqt_estoque_disponivel !== null && p.xqt_estoque_disponivel < 1) {
        toast({ title: 'Produto indisponível', variant: 'destructive' }); return prev;
      }
      return [...prev, { produto: p, qty: 1 }];
    });
  };

  const updateQty = (prodId: number, delta: number) => {
    setCart(prev => prev.map(ci => {
      if (ci.produto.id !== prodId) return ci;
      const newQty = ci.qty + delta;
      if (newQty < 1) return null as any;
      const validaEstoque = params?.xlg_valida_estoque_link ?? true;
      if (delta > 0 && validaEstoque && ci.produto.xqt_estoque_disponivel !== null && newQty > ci.produto.xqt_estoque_disponivel) {
        toast({ title: 'Estoque insuficiente', variant: 'destructive' }); return ci;
      }
      return { ...ci, qty: newQty };
    }).filter(Boolean));
  };

  const removeFromCart = (prodId: number) => setCart(prev => prev.filter(ci => ci.produto.id !== prodId));

  /* Customer lookup by CPF */
  const [cpfChecked, setCpfChecked] = useState(false);

  const handleCpfLookup = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) { toast({ title: 'CPF inválido', variant: 'destructive' }); return; }

    const { data: existing, error } = await db.rpc('fu_get_cliente_public', { _cpf: cleanCpf });

    if (!error && existing && existing.length > 0) {
      const c = existing[0];
      setCustomerName(c.razao_social || '');
      setCustomerPhone(c.fone_geral || '');
      setChildrenNames(c.dep_nome1 || '');
      setClienteId(c.id);
    }
    setCpfChecked(true);
  };

  const handleIdentify = async () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) { toast({ title: 'CPF inválido', variant: 'destructive' }); return; }
    if (!customerName.trim()) { toast({ title: 'Informe o nome completo', variant: 'destructive' }); return; }

    const { data: clientePublicId, error } = await db.rpc('fu_upsert_cliente_public', {
      _cpf: cleanCpf,
      _nome: customerName.trim(),
      _telefone: customerPhone.trim() || null,
      _filhos: null,
    });

    if (error || !clientePublicId) {
      toast({ title: 'Erro ao identificar cliente', description: error?.message || 'Não foi possível salvar seus dados', variant: 'destructive' });
      return;
    }

    setClienteId(Number(clientePublicId));
    setStep('menu');
    loadHistorico(cleanCpf);
  };

  /* Load order history */
  const loadHistorico = useCallback(async (cpfVal?: string) => {
    const cleanCpf = (cpfVal || cpf).replace(/\D/g, '');
    if (!cleanCpf) return;
    setLoadingHistorico(true);

    const { data: pedidos, error } = await db.rpc('fu_list_pedidos_public', { _cpf: cleanCpf });

    if (error || !pedidos) {
      setHistorico([]);
      setLoadingHistorico(false);
      return;
    }

    const result: PedidoHistorico[] = (pedidos || []).map((p: any) => ({
      id: p.id,
      xnr_pedido: p.nr_movimento,
      xdt_pedido: p.dt_emissao,
      xvl_total_liquido: Number(p.vl_movimento || 0),
      xst_pedido: p.st_pedido,
      items: Array.isArray(p.items) ? p.items : [],
    }));

    setHistorico(result);
    setLoadingHistorico(false);
  }, [cpf]);

  /* Reorder */
  const handleReorder = (pedido: PedidoHistorico) => {
    const newCart: CartItem[] = [];
    for (const item of pedido.items) {
      const prod = produtos.find(p => p.id === item.xproduto_id);
      if (prod) newCart.push({ produto: prod, qty: item.xqt_item });
    }
    if (newCart.length === 0) { toast({ title: 'Nenhum produto disponível para refazer', variant: 'destructive' }); return; }
    setCart(newCart);
    setActiveTab('cardapio');
    toast({ title: `Carrinho preenchido com ${newCart.length} item(ns) do pedido #${pedido.xnr_pedido}` });
  };

  /* Submit order */
  const handleSubmit = async () => {
    if (cart.length === 0) { toast({ title: 'Carrinho vazio', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const { data: pedido, error: pedErr } = await db.from('emovimento').insert({
        tp_origem: 'LINK',
        nm_responsavel: customerName,
        email_responsavel: customerEmail || null,
        nr_telefone_responsavel: customerPhone || null,
        nm_crianca: null,
        vl_produto: cartTotal,
        vl_movimento: cartTotal,
        cliente_id: clienteId,
      }).select('emovimento_id, nr_movimento').single();
      if (pedErr) throw pedErr;

      const items = cart.map(ci => ({
        emovimento_id: pedido.emovimento_id,
        produto_id: ci.produto.id,
        cd_produto: ci.produto.xcd_produto,
        nm_produto: ci.produto.xnm_produto,
        unidade_id: 'UN',
        qt_movimento: ci.qty,
        vl_und_produto: ci.produto.xvl_preco_venda,
        vl_produto: ci.qty * ci.produto.xvl_preco_venda,
        vl_movimento: ci.qty * ci.produto.xvl_preco_venda,
      }));
      const { error: itemErr } = await db.from('emovimento_item').insert(items);
      if (itemErr) throw itemErr;

      setPedidoId(pedido.emovimento_id); setPedidoNr(pedido.nr_movimento);

      // Create billing
      const amountCents = Math.round(cartTotal * 100);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const baseUrl = `https://${projectId}.supabase.co/functions/v1`;
      const res = await fetch(`${baseUrl}/create-billing-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          pedidoId: pedido.emovimento_id, customerName, customerEmail: customerEmail || `${cpf.replace(/\D/g, '')}@cliente.local`,
          customerCellphone: customerPhone, customerTaxId: cpf.replace(/\D/g, ''),
          amount: amountCents, description: `Pedido #${pedido.nr_movimento} - Lanchonete`,
          returnUrl: window.location.origin + '/loja',
          completionUrl: window.location.origin + '/loja?paid=1',
        }),
      });
      const billingData = await res.json();

      if (!res.ok || billingData.error || (!billingData.paymentUrl && !billingData.pixCode && !billingData.qrCodeImage)) {
        console.error('Billing error:', billingData);
        // Cancela o pedido recém-criado para não deixar órfão
        try {
          await db.from('emovimento').update({
            st_pedido: 'C',
            dt_cancelamento: new Date().toISOString()
          }).eq('emovimento_id', pedido.emovimento_id);
        } catch (cancelErr) {
          console.error('Falha ao cancelar pedido órfão:', cancelErr);
        }
        setPedidoId(null);
        setPedidoNr(null);
        toast({
          title: 'Não foi possível gerar o PIX',
          description: billingData?.error || 'Verifique a configuração de pagamento e tente novamente.',
          variant: 'destructive',
        });
        // Permanece no carrinho
      } else {
        setPaymentUrl(billingData.paymentUrl || '');
        setPaymentPixCode(billingData.pixCode || '');
        setPaymentQrCodeImage(billingData.qrCodeImage || '');
        setStep('payment');
      }
    } catch (e: any) {
      toast({ title: 'Erro ao criar pedido', description: e.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  /* Poll for payment */
  useEffect(() => {
    if (step !== 'payment' || !pedidoId) return;
    const interval = setInterval(async () => {
      const { data } = await db.rpc('fu_get_pedido_status_public', {
        _pedido_id: pedidoId,
        _cpf: cpf,
      });

      const status = data?.[0]?.st_pedido;
      if (status === 'R' || status === 'F') {
        clearInterval(interval);
        setPaymentConfirmed(true);
        toast({ title: '✅ Pagamento confirmado!' });
        // Wait 3 seconds then redirect to orders tab
        setTimeout(() => {
          loadHistorico();
          setActiveTab('pedidos');
          setStep('menu');
          setCart([]);
          setPaymentUrl('');
          setPaymentPixCode('');
          setPaymentQrCodeImage('');
          setPaymentConfirmed(false);
        }, 3000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [step, pedidoId, loadHistorico]);

  /* Copy to clipboard */
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(paymentPixCode || paymentUrl);
      toast({ title: 'Link copiado!' });
    } catch { toast({ title: 'Erro ao copiar', variant: 'destructive' }); }
  };

  /* ─── render ─── */
  if (loading || lojaAberta === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lojaAberta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center gap-4">
        {params?.xurl_logo && <img src={params.xurl_logo} alt="logo" className="max-h-20 w-auto rounded-lg" />}
        <Clock className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Loja Fechada</h1>
        <p className="text-muted-foreground max-w-sm">
          No momento estamos fora do horário de funcionamento. Por favor, volte durante o horário de atendimento.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {(step === 'cart' || step === 'payment') && (
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => { if (step === 'cart') setStep('menu'); }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {params?.xurl_logo ? (
              <img src={params.xurl_logo} alt="logo" className="max-h-10 w-auto rounded-lg object-contain" />
            ) : (
              <UtensilsCrossed className="h-6 w-6" />
            )}
          </div>
          {step === 'menu' && (
            <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 relative"
              onClick={() => cart.length > 0 && setStep('cart')}>
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {/* ──── STEP: IDENTIFY ──── */}
        {step === 'identify' && (
          <div className="max-w-md mx-auto space-y-6 py-8">
            <div className="text-center space-y-2">
              <User className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-xl font-bold">Identificação</h2>
              <p className="text-sm text-muted-foreground">
                {!cpfChecked ? 'Informe seu CPF para continuar' : 'Confirme seus dados'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>CPF *</Label>
                <Input value={cpf} onChange={e => { setCpf(e.target.value); if (cpfChecked) setCpfChecked(false); }}
                  placeholder="000.000.000-00" disabled={cpfChecked} />
              </div>

              {!cpfChecked ? (
                <Button className="w-full py-6 text-base" onClick={handleCpfLookup}>
                  Consultar CPF
                </Button>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Nome Completo *</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome e Sobrenome" />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1">
                    <Label>E-mail</Label>
                    <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="seu@email.com" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 py-6 text-base" onClick={() => { setCpfChecked(false); setCpf(''); setCustomerName(''); setCustomerPhone(''); setChildrenNames(''); setCustomerEmail(''); setClienteId(null); }}>
                      Alterar CPF
                    </Button>
                    <Button className="flex-1 py-6 text-base" onClick={handleIdentify}>
                      Continuar
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ──── STEP: MENU (with tabs) ──── */}
        {step === 'menu' && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cardapio" className="gap-1">{params?.xnm_aba_lojavirtual || 'Cardápio'}</TabsTrigger>
              <TabsTrigger value="pedidos" className="gap-1"><ClipboardList className="h-4 w-4" /> Meus Pedidos</TabsTrigger>
            </TabsList>

            <TabsContent value="cardapio" className="space-y-4 pb-28">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {groups.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <Badge variant={groupFilter === null ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setGroupFilter(null)}>Todos</Badge>
                  {groups.map(g => (
                    <Badge key={g} variant={groupFilter === g ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setGroupFilter(g)}>{g}</Badge>
                  ))}
                </div>
              )}
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhum produto disponível hoje</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filtered.map(p => {
                    const inCart = cart.find(ci => ci.produto.id === p.id);
                    const soldOut = (params?.xlg_valida_estoque_link ?? true) && p.xqt_estoque_disponivel !== null && p.xqt_estoque_disponivel < 1;
                    return (
                      <Card key={p.id} className={`overflow-hidden transition-shadow hover:shadow-lg ${soldOut ? 'opacity-50' : ''}`}>
                        <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                          {p.xurl_foto ? <img src={p.xurl_foto} alt={p.xnm_produto} className="w-full h-full object-cover" /> : <UtensilsCrossed className="h-10 w-10 text-muted-foreground/30" />}
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <p className="font-medium text-sm line-clamp-2 leading-tight">{p.xnm_produto}</p>
                          <span className="text-primary font-bold text-sm">{fmt(p.xvl_preco_venda)}</span>
                          {soldOut ? (
                            <Badge variant="destructive" className="text-xs">Esgotado</Badge>
                          ) : (
                            <div className="flex items-center justify-between mt-1">
                              {inCart ? (
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(p.id, -1)}><Minus className="h-3 w-3" /></Button>
                                  <span className="w-6 text-center font-bold text-sm">{inCart.qty}</span>
                                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => addToCart(p)}><Plus className="h-3 w-3" /></Button>
                                </div>
                              ) : (
                                <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={() => addToCart(p)}><Plus className="h-3 w-3" /> Adicionar</Button>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              {cartCount > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
                  <Button className="w-full shadow-xl py-6 text-base gap-3" onClick={() => setStep('cart')}>
                    <ShoppingCart className="h-5 w-5" />
                    Ver Carrinho ({cartCount} {cartCount === 1 ? 'item' : 'itens'})
                    <span className="ml-auto font-bold">{fmt(cartTotal)}</span>
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pedidos" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Últimos Pedidos</h2>
                <Button variant="outline" size="sm" onClick={() => loadHistorico()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {loadingHistorico ? (
                <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
              ) : historico.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</p>
              ) : (
                historico.map(ped => (
                  <Card key={ped.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold">Pedido #{ped.xnr_pedido}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(ped.xdt_pedido).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <Badge variant={ped.xst_pedido === 'C' ? 'destructive' : 'default'}>
                        {STATUS_LABEL[ped.xst_pedido] || ped.xst_pedido}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {ped.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{it.xqt_item}x {it.xnm_produto}</span>
                          <span>{fmt(it.xvl_unitario * it.xqt_item)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-bold text-primary">{fmt(ped.xvl_total_liquido)}</span>
                      {ped.xst_pedido !== 'C' && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => handleReorder(ped)}>
                          <RefreshCw className="h-3 w-3" /> Refazer Pedido
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* ──── STEP: CART ──── */}
        {step === 'cart' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Seu Carrinho</h2>
            {cart.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">Carrinho vazio</p>
                <Button variant="outline" onClick={() => setStep('menu')}>Voltar ao cardápio</Button>
              </div>
            ) : (
              <>
                {cart.map(ci => (
                  <Card key={ci.produto.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {ci.produto.xurl_foto ? <img src={ci.produto.xurl_foto} alt="" className="w-full h-full object-cover" /> :
                          <div className="w-full h-full flex items-center justify-center"><UtensilsCrossed className="h-6 w-6 text-muted-foreground/30" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ci.produto.xnm_produto}</p>
                        <p className="text-primary font-bold text-sm">{fmt(ci.produto.xvl_preco_venda)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(ci.produto.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="w-8 text-center font-bold text-sm">{ci.qty}</span>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(ci.produto.id, 1)}><Plus className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(ci.produto.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
                <div className="border-t pt-4 space-y-2">
                  {cart.map(ci => (
                    <div key={ci.produto.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{ci.qty}x {ci.produto.xnm_produto}</span>
                      <span>{fmt(ci.produto.xvl_preco_venda * ci.qty)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span><span className="text-primary">{fmt(cartTotal)}</span>
                  </div>
                </div>

                {/* Customer summary */}
                <Card className="p-3 bg-muted/50">
                  <p className="text-sm font-medium mb-1">Dados do Pedido</p>
                  <p className="text-xs text-muted-foreground">CPF: {cpf}</p>
                  <p className="text-xs text-muted-foreground">Nome: {customerName}</p>
                </Card>

                <Button className="w-full py-6 text-base gap-2" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Criando pedido...</> :
                    <><CreditCard className="h-5 w-5" /> Finalizar e Pagar via PIX</>}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ──── STEP: PAYMENT ──── */}
        {step === 'payment' && (
          <div className="max-w-md mx-auto text-center space-y-6 py-8">
            {paymentConfirmed ? (
              <>
                <CheckCircle2 className="h-20 w-20 mx-auto text-green-500" />
                <h2 className="text-2xl font-bold text-green-600">Pagamento Confirmado!</h2>
                <p className="text-muted-foreground">Redirecionando para seus pedidos...</p>
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </>
            ) : (
              <>
                <Clock className="h-16 w-16 mx-auto text-yellow-500 animate-pulse" />
                <h2 className="text-xl font-bold">Aguardando Pagamento</h2>
                <p className="text-muted-foreground">Pedido <strong>#{pedidoNr}</strong> criado! Pague via PIX para confirmar.</p>

                {(paymentUrl || paymentPixCode || paymentQrCodeImage) && (
                  <>
                    <div className="flex justify-center">
                      <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-4">
                        <img
                          src={paymentQrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentPixCode || paymentUrl)}`}
                          alt="QR Code PIX" className="h-48 w-48"
                        />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-primary">{fmt(cartTotal)}</p>

                    <Button className="w-full gap-2" variant="outline" onClick={copyLink}>
                      <Copy className="h-4 w-4" /> {paymentPixCode ? 'Copiar PIX copia e cola' : 'Copiar Link de Pagamento'}
                    </Button>

                    {paymentUrl && (
                      <Button className="w-full gap-2" variant="secondary" onClick={() => window.open(paymentUrl, '_blank')}>
                        <RefreshCw className="h-4 w-4" /> Abrir página de pagamento
                      </Button>
                    )}
                  </>
                )}
                <p className="text-xs text-muted-foreground">Esta página atualiza automaticamente quando o pagamento for confirmado.</p>
              </>
            )}
          </div>
        )}

        {/* ──── STEP: DONE (fallback) ──── */}
        {step === 'done' && (
          <div className="max-w-md mx-auto text-center space-y-6 py-12">
            <CheckCircle2 className="h-20 w-20 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold text-green-600">Pedido Confirmado!</h2>
            <p className="text-muted-foreground">{params?.xmsg_pos_pagamento || 'Seu lanche estará disponível para retirada.'}</p>
            <p className="font-bold">Pedido #{pedidoNr}</p>
            <Button variant="outline" className="gap-2" onClick={() => {
              setCart([]); setPaymentUrl(''); setPaymentPixCode(''); setPaymentQrCodeImage(''); setPedidoId(null); setPedidoNr(null);
              setStep('menu'); setActiveTab('pedidos'); loadHistorico();
            }}>
              Ver Meus Pedidos
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

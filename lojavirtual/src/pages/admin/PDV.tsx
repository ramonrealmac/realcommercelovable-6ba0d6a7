import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { formatCurrencyFromDecimal } from '@/lib/validators';
import { printReceipt } from '@/lib/receiptPdf';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, UserSearch, CreditCard,
  Banknote, QrCode, CircleDollarSign, ClipboardList, Receipt, X,
} from 'lucide-react';

const db = supabase as any;

interface CartItem {
  produtoId: number;
  xcd_produto: string;
  xnm_produto: string;
  xun_produto: string;
  xvl_unitario: number;
  xqt_item: number;
}

interface Payment {
  tipo: string;
  valor: number;
  label: string;
}

const PAYMENT_TYPES = [
  { value: 'DINHEIRO', label: 'Dinheiro', icon: Banknote },
  { value: 'CARTAO_CREDITO', label: 'Crédito', icon: CreditCard },
  { value: 'CARTAO_DEBITO', label: 'Débito', icon: CreditCard },
  { value: 'PIX', label: 'PIX', icon: QrCode },
];

export default function PDV() {
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currentPayType, setCurrentPayType] = useState('DINHEIRO');
  const [currentPayValue, setCurrentPayValue] = useState('');
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [finalizedOrders, setFinalizedOrders] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [selectedOrderPayments, setSelectedOrderPayments] = useState<any[]>([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.xvl_unitario * item.xqt_item, 0);
  const paymentsTotal = payments.reduce((sum, p) => sum + p.valor, 0);
  const remaining = cartTotal - paymentsTotal;
  const cashPayment = payments.find((p) => p.tipo === 'DINHEIRO');
  const change = cashPayment && paymentsTotal > cartTotal ? paymentsTotal - cartTotal : 0;

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Product search
  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const term = searchTerm.trim();
      const { data } = await db.from('produto').select('*')
        .eq('excluido_visivel', false)
        .or(`xcd_produto.ilike.%${term}%,xnm_produto.ilike.%${term}%,xcd_barra.eq.${term}`)
        .limit(10);
      setSearchResults(data || []);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addToCart = (produto: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.produtoId === produto.id);
      if (existing) {
        return prev.map((i) => i.produtoId === produto.id ? { ...i, xqt_item: i.xqt_item + 1 } : i);
      }
      return [...prev, {
        produtoId: produto.id,
        xcd_produto: produto.xcd_produto,
        xnm_produto: produto.xnm_produto,
        xun_produto: produto.xun_produto,
        xvl_unitario: Number(produto.xvl_preco_venda),
        xqt_item: 1,
      }];
    });
    setSearchTerm('');
    setSearchResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (produtoId: number, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.produtoId !== produtoId) return i;
      const newQty = i.xqt_item + delta;
      return newQty > 0 ? { ...i, xqt_item: newQty } : i;
    }));
  };

  const removeItem = (produtoId: number) => {
    setCart((prev) => prev.filter((i) => i.produtoId !== produtoId));
  };

  const clearSale = () => {
    setCart([]);
    setSelectedClient(null);
    setPayments([]);
    searchRef.current?.focus();
  };

  // Client search
  const searchClients = useCallback(async () => {
    if (!clientSearch.trim()) { setClientResults([]); return; }
    const { data } = await db.from('cliente').select('*')
      .eq('excluido_visivel', false)
      .or(`xnm_razao_social.ilike.%${clientSearch}%,xcd_cliente.ilike.%${clientSearch}%,xnm_crianca.ilike.%${clientSearch}%`)
      .limit(10);
    setClientResults(data || []);
  }, [clientSearch]);

  const addPayment = () => {
    const valor = parseFloat(currentPayValue);
    if (!valor || valor <= 0) { toast({ title: 'Informe um valor', variant: 'destructive' }); return; }
    const label = PAYMENT_TYPES.find((t) => t.value === currentPayType)?.label || currentPayType;
    setPayments((prev) => [...prev, { tipo: currentPayType, valor, label }]);
    setCurrentPayValue('');
  };

  const removePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  // Finalize order
  const finalizeSale = async () => {
    if (cart.length === 0) { toast({ title: 'Adicione itens', variant: 'destructive' }); return; }
    if (remaining > 0.01) { toast({ title: `Falta ${formatCurrencyFromDecimal(remaining)}`, variant: 'destructive' }); return; }

    setProcessing(true);
    try {
      const clienteId = selectedClient?.id || 1;

      // Create order
      const { data: pedido, error: pedidoErr } = await db.from('pedido').insert({
        xcliente_id: clienteId,
        xtipo_origem_pedido: 'PDV',
        xst_pedido: 'A',
        xhr_pedido: new Date().toLocaleTimeString('pt-BR'),
        xvl_total_bruto: cartTotal,
        xvl_total_liquido: cartTotal,
        xlg_pedido_pdv: true,
        xusuario_id: user?.id,
        xnm_responsavel: selectedClient?.xnm_razao_social || 'CONSUMIDOR FINAL',
      }).select('id, xnr_pedido').single();

      if (pedidoErr) throw pedidoErr;

      // Insert items
      const items = cart.map((i) => ({
        xpedido_id: pedido.id,
        xproduto_id: i.produtoId,
        xcd_produto: i.xcd_produto,
        xnm_produto: i.xnm_produto,
        xun_produto: i.xun_produto,
        xqt_item: i.xqt_item,
        xvl_unitario: i.xvl_unitario,
      }));
      const { error: itemErr } = await db.from('pedido_item').insert(items);
      if (itemErr) throw itemErr;

      // Insert payments
      const pagamentos = payments.map((p) => ({
        xpedido_id: pedido.id,
        xtp_pagamento: p.tipo,
        xvl_pagamento: p.valor,
      }));
      const { error: pagErr } = await db.from('pedido_pagamento').insert(pagamentos);
      if (pagErr) throw pagErr;

      // Transition A -> F (finalize - reserves stock)
      const { data: result } = await db.rpc('fu_transition_pedido_status', {
        _pedido_id: pedido.id,
        _novo_status: 'F',
        _usuario_id: user?.id,
      });

      if (result?.error) throw new Error(result.error);

      // Transition F -> T (invoice - decreases physical stock)
      const { data: result2 } = await db.rpc('fu_transition_pedido_status', {
        _pedido_id: pedido.id,
        _novo_status: 'T',
        _usuario_id: user?.id,
      });

      if (result2?.error) throw new Error(result2.error);

      // Print receipt
      printReceipt({
        nrPedido: pedido.xnr_pedido,
        nomeCliente: selectedClient?.xnm_razao_social || 'CONSUMIDOR FINAL',
        nomeCrianca: selectedClient?.xnm_crianca,
        items: cart.map(i => ({ xnm_produto: i.xnm_produto, xqt_item: i.xqt_item, xvl_unitario: i.xvl_unitario })),
        payments: payments.map(p => ({ label: p.label, valor: p.valor })),
        total: cartTotal,
        troco: change,
      });

      toast({ title: `Pedido #${pedido.xnr_pedido} faturado!` });
      clearSale();
    } catch (err: any) {
      toast({ title: 'Erro ao finalizar', description: err.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  // Search finalized orders
  const searchFinalizedOrders = async () => {
    const { data } = await db.from('pedido').select('*, cliente:xcliente_id(xnm_razao_social)')
      .eq('xst_pedido', 'F').eq('excluido_visivel', false)
      .order('xdt_pedido', { ascending: false }).limit(20);
    setFinalizedOrders(data || []);
    setOrdersDialogOpen(true);
  };

  const openOrderDetail = async (order: any) => {
    setSelectedOrder(order);
    // Load items
    const { data: items } = await db.from('pedido_item').select('*')
      .eq('xpedido_id', order.id).eq('excluido_visivel', false);
    setSelectedOrderItems(items || []);
    // Load payments
    const { data: pags } = await db.from('pedido_pagamento').select('*')
      .eq('xpedido_id', order.id).eq('excluido_visivel', false);
    setSelectedOrderPayments(pags || []);
    setOrderDetailDialogOpen(true);
  };

  const invoiceOrder = async (pedidoId: number) => {
    setProcessing(true);
    const { data: result } = await db.rpc('fu_transition_pedido_status', {
      _pedido_id: pedidoId,
      _novo_status: 'T',
      _usuario_id: user?.id,
    });
    if (result?.error) {
      toast({ title: 'Erro', description: result.error, variant: 'destructive' });
    } else {
      // Print receipt for invoiced order
      if (selectedOrder) {
        printReceipt({
          nrPedido: selectedOrder.xnr_pedido,
          nomeCliente: selectedOrder.xnm_responsavel || selectedOrder.cliente?.xnm_razao_social || 'CONSUMIDOR FINAL',
          nomeCrianca: selectedOrder.xnm_crianca,
          items: selectedOrderItems.map((i: any) => ({ xnm_produto: i.xnm_produto, xqt_item: Number(i.xqt_item), xvl_unitario: Number(i.xvl_unitario) })),
          payments: selectedOrderPayments.map((p: any) => ({
            label: PAYMENT_TYPES.find(t => t.value === p.xtp_pagamento)?.label || p.xtp_pagamento,
            valor: Number(p.xvl_pagamento),
          })),
          total: Number(selectedOrder.xvl_total_liquido),
          isPagamentoOnline: selectedOrder.xlg_pagamento_online,
        });
      }
      toast({ title: 'Pedido faturado!' });
      setOrderDetailDialogOpen(false);
      setOrdersDialogOpen(false);
    }
    setProcessing(false);
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col lg:flex-row">
      {/* Left: Search + Results */}
      <div className="flex-1 flex flex-col border-r min-w-0">
        <div className="p-4 border-b bg-card">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">PDV</h1>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setClientDialogOpen(true); searchClients(); }}>
              <UserSearch className="w-4 h-4" />
              <span className="hidden sm:inline">{selectedClient?.xnm_razao_social || 'Cliente'}</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={searchFinalizedOrders}>
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Finalizados</span>
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Código, código de barras ou nome do produto..."
              className="pl-9 text-lg h-12"
              autoFocus
            />
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border-b bg-card">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
              >
                {p.xurl_foto ? (
                  <img src={p.xurl_foto} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs font-mono">{p.xcd_produto}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.xnm_produto}</p>
                  <p className="text-sm text-muted-foreground">{p.xcd_produto} • {p.xun_produto}</p>
                </div>
                <span className="font-bold text-primary">{formatCurrencyFromDecimal(Number(p.xvl_preco_venda))}</span>
              </button>
            ))}
          </div>
        )}

        {/* Cart items */}
        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground p-8">
              <div className="text-center">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Digite o código ou nome para adicionar itens</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((item) => (
                <div key={item.produtoId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.xnm_produto}</p>
                    <p className="text-sm text-muted-foreground">{item.xcd_produto} • {formatCurrencyFromDecimal(item.xvl_unitario)}/{item.xun_produto}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.produtoId, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-8 text-center font-bold">{item.xqt_item}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.produtoId, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="font-bold w-24 text-right">{formatCurrencyFromDecimal(item.xvl_unitario * item.xqt_item)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.produtoId)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: Summary + Actions */}
      <div className="w-full lg:w-80 flex flex-col bg-card border-t lg:border-t-0">
        <div className="p-4 space-y-3 flex-1">
          <div className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{selectedClient?.xnm_razao_social || 'CONSUMIDOR FINAL'}</span>
          </div>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Itens:</span>
              <span className="font-medium">{cart.reduce((s, i) => s + i.xqt_item, 0)}</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-3xl font-bold text-primary">{formatCurrencyFromDecimal(cartTotal)}</span>
          </div>

          <Button
            className="w-full h-14 text-lg gap-2"
            disabled={cart.length === 0}
            onClick={() => { setPayments([]); setPaymentDialogOpen(true); }}
          >
            <CircleDollarSign className="w-5 h-5" /> Finalizar Venda
          </Button>

          <Button variant="outline" className="w-full" onClick={clearSale} disabled={cart.length === 0}>
            Nova Venda
          </Button>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento — {formatCurrencyFromDecimal(cartTotal)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add payment */}
            <div className="flex gap-2">
              <Select value={currentPayType} onValueChange={setCurrentPayType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Valor"
                value={currentPayValue}
                onChange={(e) => setCurrentPayValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPayment()}
                className="flex-1"
              />
              <Button onClick={addPayment} size="icon"><Plus className="w-4 h-4" /></Button>
            </div>

            {/* Payment list */}
            {payments.length > 0 && (
              <div className="border rounded-lg divide-y">
                {payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm">{p.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{formatCurrencyFromDecimal(p.valor)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePayment(i)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Total da venda:</span><span className="font-bold">{formatCurrencyFromDecimal(cartTotal)}</span></div>
              <div className="flex justify-between"><span>Total pago:</span><span className="font-bold">{formatCurrencyFromDecimal(paymentsTotal)}</span></div>
              {remaining > 0.01 && (
                <div className="flex justify-between text-destructive"><span>Falta:</span><span className="font-bold">{formatCurrencyFromDecimal(remaining)}</span></div>
              )}
              {change > 0 && (
                <div className="flex justify-between text-green-600 text-lg font-bold pt-1">
                  <span>Troco:</span><span>{formatCurrencyFromDecimal(change)}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={finalizeSale} disabled={processing || remaining > 0.01}>
              {processing ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client search dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buscar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Nome, código ou criança..."
                onKeyDown={(e) => e.key === 'Enter' && searchClients()}
              />
              <Button onClick={searchClients}>Buscar</Button>
            </div>
            <div className="border rounded-lg max-h-60 overflow-auto divide-y">
              {clientResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                  onClick={() => { setSelectedClient(c); setClientDialogOpen(false); }}
                >
                  <p className="font-medium">{c.xnm_razao_social}</p>
                  <p className="text-sm text-muted-foreground">{c.xcd_cliente} {c.xnm_crianca ? `• ${c.xnm_crianca}` : ''}</p>
                </button>
              ))}
              {clientResults.length === 0 && <p className="p-3 text-sm text-muted-foreground text-center">Nenhum resultado</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedClient(null); setClientDialogOpen(false); }}>Consumidor Final</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalized orders dialog */}
      <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pedidos Finalizados (Aguardando Faturamento)</DialogTitle></DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="border rounded-lg divide-y">
              {finalizedOrders.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nenhum pedido finalizado</p>
              ) : finalizedOrders.map((o) => (
                <button
                  key={o.id}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  onClick={() => openOrderDetail(o)}
                >
                  <div>
                    <p className="font-medium">Pedido #{o.xnr_pedido}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.cliente?.xnm_razao_social || o.xnm_responsavel || 'Consumidor'} • {formatCurrencyFromDecimal(Number(o.xvl_total_liquido))}
                      {o.xlg_pagamento_online && <Badge className="ml-2" variant="secondary">PIX Online</Badge>}
                    </p>
                    {o.xnm_crianca && <p className="text-xs text-muted-foreground">Criança: {o.xnm_crianca}</p>}
                  </div>
                  <span className="text-sm text-muted-foreground">Ver →</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Order detail + invoice dialog */}
      <Dialog open={orderDetailDialogOpen} onOpenChange={setOrderDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Pedido #{selectedOrder?.xnr_pedido} — Entregar e Faturar
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Responsável:</span> {selectedOrder.xnm_responsavel || 'Consumidor Final'}</p>
                {selectedOrder.xnm_crianca && <p><span className="text-muted-foreground">Criança:</span> {selectedOrder.xnm_crianca}</p>}
                {selectedOrder.xlg_pagamento_online && <Badge variant="secondary">Pago Online (PIX)</Badge>}
              </div>

              <Separator />

              {/* Products to deliver */}
              <div>
                <p className="text-sm font-semibold mb-2">Produtos para entrega:</p>
                <div className="border rounded-lg divide-y">
                  {selectedOrderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.xnm_produto}</p>
                        <p className="text-xs text-muted-foreground">{item.xcd_produto} • {item.xun_produto}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium">{Number(item.xqt_item)}x {formatCurrencyFromDecimal(Number(item.xvl_unitario))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Payment info (pre-filled, read-only) */}
              <div>
                <p className="text-sm font-semibold mb-2">Pagamento:</p>
                {selectedOrderPayments.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {selectedOrderPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm">{PAYMENT_TYPES.find(t => t.value === p.xtp_pagamento)?.label || p.xtp_pagamento}</span>
                        <span className="font-mono font-medium">{formatCurrencyFromDecimal(Number(p.xvl_pagamento))}</span>
                      </div>
                    ))}
                  </div>
                ) : selectedOrder.xlg_pagamento_online ? (
                  <div className="border rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-sm">PIX Online</span>
                    <span className="font-mono font-medium">{formatCurrencyFromDecimal(Number(selectedOrder.xvl_total_liquido))}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem pagamento registrado</p>
                )}
              </div>

              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrencyFromDecimal(Number(selectedOrder.xvl_total_liquido))}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDetailDialogOpen(false)}>Voltar</Button>
            <Button onClick={() => selectedOrder && invoiceOrder(selectedOrder.id)} disabled={processing}>
              {processing ? 'Processando...' : 'Confirmar Entrega e Faturar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

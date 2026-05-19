import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Settings, School, Clock, Link2, Warehouse, Palette, Mail, CreditCard,
  Save, RotateCcw, Copy, Upload, Eye,
} from 'lucide-react';

const db = supabase as any;

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const COLOR_FIELDS = [
  { key: 'xcor_primaria', label: 'Cor Primária' },
  { key: 'xcor_secundaria', label: 'Cor Secundária' },
  { key: 'xcor_destaque', label: 'Cor Destaque' },
  { key: 'xcor_fundo', label: 'Cor de Fundo' },
  { key: 'xcor_fundo_card', label: 'Fundo dos Cards' },
  { key: 'xcor_texto_principal', label: 'Texto Principal' },
  { key: 'xcor_texto_secundario', label: 'Texto Secundário' },
  { key: 'xcor_botao', label: 'Botões' },
  { key: 'xcor_botao_negativo', label: 'Botão Negativo' },
  { key: 'xcor_header', label: 'Header' },
  { key: 'xcor_menu', label: 'Menu' },
  { key: 'xcor_link', label: 'Links' },
];

const DEFAULT_COLORS: Record<string, string> = {
  xcor_primaria: '#8B5CF6', xcor_secundaria: '#6D28D9', xcor_destaque: '#F59E0B',
  xcor_fundo: '#FFFFFF', xcor_fundo_card: '#F8FAFC', xcor_texto_principal: '#1E293B',
  xcor_texto_secundario: '#64748B', xcor_botao: '#8B5CF6', xcor_botao_negativo: '#EF4444',
  xcor_header: '#7C3AED', xcor_menu: '#4C1D95', xcor_link: '#8B5CF6',
};

interface Horario {
  id: number;
  xdia_semana: number;
  xhr_inicio_matutino: string | null;
  xhr_fim_matutino: string | null;
  xhr_inicio_vespertino: string | null;
  xhr_fim_vespertino: string | null;
  xlg_dia_ativo: boolean;
}

export default function Parametros() {
  const [params, setParams] = useState<any>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File, paramKey: string) => {
    setUploading(paramKey);
    try {
      const ext = file.name.split('.').pop();
      const path = `escola/${paramKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('produtos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('produtos').getPublicUrl(path);
      updateParam(paramKey, publicUrl);
      toast({ title: 'Upload concluído!' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    }
    setUploading(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await db.from('parametro').select('*').eq('excluido_visivel', false).limit(1).single();
    if (p) setParams(p);
    const { data: h } = await db.from('parametro_horario').select('*').order('xdia_semana');
    if (h) setHorarios(h);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateParam = (key: string, value: any) => {
    setParams((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateHorario = (idx: number, key: string, value: any) => {
    setHorarios(prev => prev.map((h, i) => i === idx ? { ...h, [key]: value } : h));
  };

  const save = async () => {
    if (!params) return;
    setSaving(true);
    try {
      const { id, ...rest } = params;
      delete rest.xdt_cadastro;
      delete rest.xdt_alteracao;
      const { error } = await db.from('parametro').update(rest).eq('id', id);
      if (error) throw error;

      for (const h of horarios) {
        const { id: hid, ...hrest } = h;
        await db.from('parametro_horario').update(hrest).eq('id', hid);
      }
      toast({ title: 'Parâmetros salvos com sucesso!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const resetColors = () => {
    Object.entries(DEFAULT_COLORS).forEach(([k, v]) => updateParam(k, v));
    updateParam('xcss_customizado', '');
  };

  const copyLink = () => {
    const url = params?.xurl_link_vendas || `${window.location.origin}/loja`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!' });
  };

  if (loading || !params) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Parâmetros</h1>
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      <Tabs defaultValue="escola" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="escola" className="gap-1"><School className="w-3.5 h-3.5" /> Escola</TabsTrigger>
          <TabsTrigger value="horarios" className="gap-1"><Clock className="w-3.5 h-3.5" /> Horários</TabsTrigger>
          <TabsTrigger value="link" className="gap-1"><Link2 className="w-3.5 h-3.5" /> Link de Vendas</TabsTrigger>
          <TabsTrigger value="estoque" className="gap-1"><Warehouse className="w-3.5 h-3.5" /> Estoque</TabsTrigger>
          <TabsTrigger value="abacatepay" className="gap-1"><CreditCard className="w-3.5 h-3.5" /> AbacatePay</TabsTrigger>
          <TabsTrigger value="tema" className="gap-1"><Palette className="w-3.5 h-3.5" /> Tema</TabsTrigger>
          <TabsTrigger value="comunicacao" className="gap-1"><Mail className="w-3.5 h-3.5" /> Comunicação</TabsTrigger>
        </TabsList>

        {/* === Escola === */}
        <TabsContent value="escola">
          <Card>
            <CardHeader><CardTitle>Dados da Escola</CardTitle><CardDescription>Informações básicas da escola.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Escola</Label>
                <Input value={params.xnm_escola || ''} onChange={e => updateParam('xnm_escola', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex gap-2">
                    <Input value={params.xurl_logo || ''} onChange={e => updateParam('xurl_logo', e.target.value)} placeholder="https://..." className="flex-1" />
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'xurl_logo')} />
                    <Button type="button" variant="outline" size="icon" onClick={() => logoRef.current?.click()} disabled={uploading === 'xurl_logo'}>
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  {params.xurl_logo && <img src={params.xurl_logo} alt="Logo" className="h-16 object-contain rounded border p-1" />}
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="flex gap-2">
                    <Input value={params.xurl_favicon || ''} onChange={e => updateParam('xurl_favicon', e.target.value)} placeholder="https://..." className="flex-1" />
                    <input ref={faviconRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'xurl_favicon')} />
                    <Button type="button" variant="outline" size="icon" onClick={() => faviconRef.current?.click()} disabled={uploading === 'xurl_favicon'}>
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  {params.xurl_favicon && <img src={params.xurl_favicon} alt="Favicon" className="h-10 object-contain rounded border p-1" />}
                </div>
                <div className="space-y-2">
                  <Label>Banner de Vendas</Label>
                  <div className="flex gap-2">
                    <Input value={params.xurl_banner_vendas || ''} onChange={e => updateParam('xurl_banner_vendas', e.target.value)} placeholder="https://..." className="flex-1" />
                    <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0], 'xurl_banner_vendas')} />
                    <Button type="button" variant="outline" size="icon" onClick={() => bannerRef.current?.click()} disabled={uploading === 'xurl_banner_vendas'}>
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                  {params.xurl_banner_vendas && <img src={params.xurl_banner_vendas} alt="Banner" className="h-16 w-full object-cover rounded border" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Horários === */}
        <TabsContent value="horarios">
          <Card>
            <CardHeader><CardTitle>Horários de Funcionamento</CardTitle><CardDescription>Controla o horário de disponibilidade do link de vendas.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Dia</th>
                      <th className="p-2">Ativo</th>
                      <th className="p-2">Mat. Início</th>
                      <th className="p-2">Mat. Fim</th>
                      <th className="p-2">Vesp. Início</th>
                      <th className="p-2">Vesp. Fim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {horarios.map((h, idx) => (
                      <tr key={h.id} className="border-b">
                        <td className="p-2 font-medium">{DIAS[h.xdia_semana]}</td>
                        <td className="p-2">
                          <Switch checked={h.xlg_dia_ativo} onCheckedChange={v => updateHorario(idx, 'xlg_dia_ativo', v)} />
                        </td>
                        <td className="p-2"><Input type="time" value={h.xhr_inicio_matutino || ''} onChange={e => updateHorario(idx, 'xhr_inicio_matutino', e.target.value)} className="w-28" disabled={!h.xlg_dia_ativo} /></td>
                        <td className="p-2"><Input type="time" value={h.xhr_fim_matutino || ''} onChange={e => updateHorario(idx, 'xhr_fim_matutino', e.target.value)} className="w-28" disabled={!h.xlg_dia_ativo} /></td>
                        <td className="p-2"><Input type="time" value={h.xhr_inicio_vespertino || ''} onChange={e => updateHorario(idx, 'xhr_inicio_vespertino', e.target.value)} className="w-28" disabled={!h.xlg_dia_ativo} /></td>
                        <td className="p-2"><Input type="time" value={h.xhr_fim_vespertino || ''} onChange={e => updateHorario(idx, 'xhr_fim_vespertino', e.target.value)} className="w-28" disabled={!h.xlg_dia_ativo} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Link de Vendas === */}
        <TabsContent value="link">
          <Card>
            <CardHeader><CardTitle>Link de Vendas</CardTitle><CardDescription>URL pública para autoatendimento de pais.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input value={params.xurl_link_vendas || `${window.location.origin}/loja`} readOnly className="flex-1 font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={params.xurl_link_vendas || '/loja'} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4" /></a>
                </Button>
              </div>
              <div className="space-y-2">
                <Label>URL personalizada do link (opcional)</Label>
                <Input value={params.xurl_link_vendas || ''} onChange={e => updateParam('xurl_link_vendas', e.target.value)} placeholder="Deixe vazio para usar /loja" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Estoque === */}
        <TabsContent value="estoque">
          <Card>
            <CardHeader><CardTitle>Validações de Estoque</CardTitle><CardDescription>Controla se o sistema valida estoque antes de confirmar vendas.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Validar estoque no Link de Vendas</p>
                  <p className="text-sm text-muted-foreground">Impede compra de itens sem estoque disponível no link público.</p>
                </div>
                <Switch checked={params.xlg_valida_estoque_link ?? true} onCheckedChange={v => updateParam('xlg_valida_estoque_link', v)} />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Validar estoque no PDV</p>
                  <p className="text-sm text-muted-foreground">Impede venda no caixa de itens sem estoque disponível.</p>
                </div>
                <Switch checked={params.xlg_valida_estoque_pdv ?? false} onCheckedChange={v => updateParam('xlg_valida_estoque_pdv', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === AbacatePay === */}
        <TabsContent value="abacatepay">
          <Card>
            <CardHeader><CardTitle>AbacatePay</CardTitle><CardDescription>Configuração da integração PIX via AbacatePay.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value={params.xabacatepay_api_key || ''} onChange={e => updateParam('xabacatepay_api_key', e.target.value)} placeholder="abc_..." />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL (endereço de recepção)</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/abacatepay-webhook`}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={() => {
                    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/abacatepay-webhook`;
                    navigator.clipboard.writeText(url);
                    toast({ title: 'URL do Webhook copiada!' });
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Copie e cole este endereço no painel do AbacatePay para receber notificações de pagamento.</p>
              </div>
              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <Input type="password" value={params.xabacatepay_webhook_secret || ''} onChange={e => updateParam('xabacatepay_webhook_secret', e.target.value)} placeholder="whsec_..." />
                <p className="text-xs text-muted-foreground">Secret fornecido pelo AbacatePay para validar a autenticidade das notificações recebidas.</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <p>A integração AbacatePay é utilizada exclusivamente para pagamentos PIX no link de vendas público. Configure a API Key fornecida pelo AbacatePay e a URL do webhook para receber confirmações de pagamento.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Tema === */}
        <TabsContent value="tema">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Aparência / Tema</CardTitle><CardDescription>Personalize as cores do sistema e do link de vendas.</CardDescription></div>
                <Button variant="outline" size="sm" className="gap-1" onClick={resetColors}><RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {COLOR_FIELDS.map(cf => (
                  <div key={cf.key} className="space-y-1.5">
                    <Label className="text-xs">{cf.label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={params[cf.key] || DEFAULT_COLORS[cf.key]}
                        onChange={e => updateParam(cf.key, e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={params[cf.key] || DEFAULT_COLORS[cf.key]}
                        onChange={e => updateParam(cf.key, e.target.value)}
                        className="flex-1 font-mono text-xs"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
                <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: params.xcor_fundo || '#fff' }}>
                  <div className="p-3" style={{ backgroundColor: params.xcor_header || '#7C3AED' }}>
                    <span className="text-sm font-bold" style={{ color: '#fff' }}>{params.xnm_escola || 'Escola'}</span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold" style={{ color: params.xcor_texto_principal || '#1E293B' }}>Produto Exemplo</p>
                    <p className="text-xs" style={{ color: params.xcor_texto_secundario || '#64748B' }}>Descrição do produto</p>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: params.xcor_botao || '#8B5CF6' }}>Comprar</button>
                      <button className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: params.xcor_botao_negativo || '#EF4444' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>CSS Customizado</Label>
                <Textarea value={params.xcss_customizado || ''} onChange={e => updateParam('xcss_customizado', e.target.value)} rows={6} placeholder="/* CSS adicional */" className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Comunicação === */}
        <TabsContent value="comunicacao">
          <Card>
            <CardHeader><CardTitle>Comunicação</CardTitle><CardDescription>Mensagens e e-mails do sistema.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>E-mail do Remetente</Label>
                <Input type="email" value={params.xemail_remetente || ''} onChange={e => updateParam('xemail_remetente', e.target.value)} placeholder="cantina@escola.com" />
              </div>
              <div className="space-y-2">
                <Label>Mensagem Pós-Pagamento</Label>
                <Textarea value={params.xmsg_pos_pagamento || ''} onChange={e => updateParam('xmsg_pos_pagamento', e.target.value)} rows={4} placeholder="Mensagem exibida após confirmação do pagamento" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

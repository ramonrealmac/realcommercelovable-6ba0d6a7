import jsPDF from 'jspdf';

const BOBBIN_WIDTH_MM = 80;
const MARGIN = 4;
const CONTENT_W = BOBBIN_WIDTH_MM - MARGIN * 2;
const FONT_SM = 7;
const FONT_MD = 8;
const FONT_LG = 10;
const LINE_H = 3.5;

interface ReceiptItem {
  xnm_produto: string;
  xqt_item: number;
  xvl_unitario: number;
}

interface ReceiptPayment {
  label: string;
  valor: number;
}

interface ReceiptData {
  nrPedido: number | string;
  nomeCliente: string;
  nomeCrianca?: string | null;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  total: number;
  troco?: number;
  nomeEscola?: string;
  isPagamentoOnline?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function generateReceipt(data: ReceiptData) {
  // Start with a tall page — we'll trim later
  const doc = new jsPDF({ unit: 'mm', format: [BOBBIN_WIDTH_MM, 300] });
  let y = MARGIN + 2;

  const center = (text: string, size: number) => {
    doc.setFontSize(size);
    const w = doc.getTextWidth(text);
    doc.text(text, (BOBBIN_WIDTH_MM - w) / 2, y);
    y += LINE_H + (size > FONT_MD ? 1 : 0);
  };

  const left = (text: string, size = FONT_SM) => {
    doc.setFontSize(size);
    doc.text(text, MARGIN, y);
    y += LINE_H;
  };

  const leftRight = (l: string, r: string, size = FONT_SM) => {
    doc.setFontSize(size);
    doc.text(l, MARGIN, y);
    const rw = doc.getTextWidth(r);
    doc.text(r, BOBBIN_WIDTH_MM - MARGIN - rw, y);
    y += LINE_H;
  };

  const dashes = () => {
    doc.setFontSize(FONT_SM);
    doc.text('-'.repeat(48), MARGIN, y);
    y += LINE_H;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  if (data.nomeEscola) {
    center(data.nomeEscola, FONT_LG);
  }
  center('CUPOM NÃO FISCAL', FONT_MD);
  y += 1;

  doc.setFont('helvetica', 'normal');
  const now = new Date();
  center(
    `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`,
    FONT_SM
  );
  y += 1;
  dashes();

  // Order number
  doc.setFont('helvetica', 'bold');
  center(`PEDIDO #${data.nrPedido}`, FONT_LG);
  doc.setFont('helvetica', 'normal');
  y += 1;

  // Customer
  left(`Cliente: ${data.nomeCliente}`, FONT_SM);
  if (data.nomeCrianca) {
    left(`Criança: ${data.nomeCrianca}`, FONT_SM);
  }
  dashes();

  // Items header
  doc.setFont('helvetica', 'bold');
  leftRight('ITEM', 'TOTAL', FONT_SM);
  doc.setFont('helvetica', 'normal');
  y += 0.5;

  for (const item of data.items) {
    // Product name (may wrap)
    const name = item.xnm_produto.length > 30
      ? item.xnm_produto.substring(0, 30) + '...'
      : item.xnm_produto;
    left(name, FONT_SM);

    const subtotal = item.xqt_item * item.xvl_unitario;
    leftRight(
      `  ${item.xqt_item}x ${fmt(item.xvl_unitario)}`,
      fmt(subtotal),
      FONT_SM
    );
  }

  dashes();

  // Total
  doc.setFont('helvetica', 'bold');
  leftRight('TOTAL', fmt(data.total), FONT_MD);
  doc.setFont('helvetica', 'normal');
  y += 1;

  // Payments
  dashes();
  left('PAGAMENTO:', FONT_SM);
  if (data.isPagamentoOnline) {
    leftRight('PIX Online', fmt(data.total), FONT_SM);
  }
  for (const p of data.payments) {
    leftRight(p.label, fmt(p.valor), FONT_SM);
  }

  if (data.troco && data.troco > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    leftRight('TROCO', fmt(data.troco), FONT_MD);
    doc.setFont('helvetica', 'normal');
  }

  dashes();
  y += 2;
  center('Obrigado pela preferência!', FONT_SM);
  y += 6;

  // Trim page to actual content height
  const pageHeight = y + MARGIN;
  const trimmedDoc = new jsPDF({ unit: 'mm', format: [BOBBIN_WIDTH_MM, pageHeight] });

  // Re-render on trimmed page
  // Unfortunately jsPDF doesn't support page resize, so we regenerate
  return generateToPdf(data, pageHeight);
}

function generateToPdf(data: ReceiptData, height: number): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: [BOBBIN_WIDTH_MM, height] });
  let y = MARGIN + 2;

  const center = (text: string, size: number) => {
    doc.setFontSize(size);
    const w = doc.getTextWidth(text);
    doc.text(text, (BOBBIN_WIDTH_MM - w) / 2, y);
    y += LINE_H + (size > FONT_MD ? 1 : 0);
  };

  const left = (text: string, size = FONT_SM) => {
    doc.setFontSize(size);
    doc.text(text, MARGIN, y);
    y += LINE_H;
  };

  const leftRight = (l: string, r: string, size = FONT_SM) => {
    doc.setFontSize(size);
    doc.text(l, MARGIN, y);
    const rw = doc.getTextWidth(r);
    doc.text(r, BOBBIN_WIDTH_MM - MARGIN - rw, y);
    y += LINE_H;
  };

  const dashes = () => {
    doc.setFontSize(FONT_SM);
    doc.text('-'.repeat(48), MARGIN, y);
    y += LINE_H;
  };

  // Header
  doc.setFont('helvetica', 'bold');
  if (data.nomeEscola) center(data.nomeEscola, FONT_LG);
  center('CUPOM NÃO FISCAL', FONT_MD);
  y += 1;

  doc.setFont('helvetica', 'normal');
  const now = new Date();
  center(`${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`, FONT_SM);
  y += 1;
  dashes();

  doc.setFont('helvetica', 'bold');
  center(`PEDIDO #${data.nrPedido}`, FONT_LG);
  doc.setFont('helvetica', 'normal');
  y += 1;

  left(`Cliente: ${data.nomeCliente}`, FONT_SM);
  if (data.nomeCrianca) left(`Criança: ${data.nomeCrianca}`, FONT_SM);
  dashes();

  doc.setFont('helvetica', 'bold');
  leftRight('ITEM', 'TOTAL', FONT_SM);
  doc.setFont('helvetica', 'normal');
  y += 0.5;

  for (const item of data.items) {
    const name = item.xnm_produto.length > 30
      ? item.xnm_produto.substring(0, 30) + '...'
      : item.xnm_produto;
    left(name, FONT_SM);
    const subtotal = item.xqt_item * item.xvl_unitario;
    leftRight(`  ${item.xqt_item}x ${fmt(item.xvl_unitario)}`, fmt(subtotal), FONT_SM);
  }

  dashes();
  doc.setFont('helvetica', 'bold');
  leftRight('TOTAL', fmt(data.total), FONT_MD);
  doc.setFont('helvetica', 'normal');
  y += 1;

  dashes();
  left('PAGAMENTO:', FONT_SM);
  if (data.isPagamentoOnline) leftRight('PIX Online', fmt(data.total), FONT_SM);
  for (const p of data.payments) leftRight(p.label, fmt(p.valor), FONT_SM);

  if (data.troco && data.troco > 0) {
    y += 1;
    doc.setFont('helvetica', 'bold');
    leftRight('TROCO', fmt(data.troco), FONT_MD);
    doc.setFont('helvetica', 'normal');
  }

  dashes();
  y += 2;
  center('Obrigado pela preferência!', FONT_SM);

  return doc;
}

export function printReceipt(data: ReceiptData) {
  const doc = generateReceipt(data);
  // Open in new window for printing
  const pdfBlob = doc.output('blob');
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, '_blank');
}

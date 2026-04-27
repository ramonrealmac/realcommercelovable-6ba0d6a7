// CPF/CNPJ validation and formatting utilities

export function validateCPF(XCpf: string): boolean {
  const XDigits = XCpf.replace(/\D/g, "");
  if (XDigits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(XDigits)) return false;

  let XSum = 0;
  for (let i = 0; i < 9; i++) XSum += parseInt(XDigits[i]) * (10 - i);
  let XRest = (XSum * 10) % 11;
  if (XRest === 10) XRest = 0;
  if (XRest !== parseInt(XDigits[9])) return false;

  XSum = 0;
  for (let i = 0; i < 10; i++) XSum += parseInt(XDigits[i]) * (11 - i);
  XRest = (XSum * 10) % 11;
  if (XRest === 10) XRest = 0;
  return XRest === parseInt(XDigits[10]);
}

export function validateCNPJ(XCnpj: string): boolean {
  const XDigits = XCnpj.replace(/\D/g, "");
  if (XDigits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(XDigits)) return false;

  const XWeights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const XWeights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let XSum = 0;
  for (let i = 0; i < 12; i++) XSum += parseInt(XDigits[i]) * XWeights1[i];
  let XRest = XSum % 11;
  const XD1 = XRest < 2 ? 0 : 11 - XRest;
  if (parseInt(XDigits[12]) !== XD1) return false;

  XSum = 0;
  for (let i = 0; i < 13; i++) XSum += parseInt(XDigits[i]) * XWeights2[i];
  XRest = XSum % 11;
  const XD2 = XRest < 2 ? 0 : 11 - XRest;
  return parseInt(XDigits[13]) === XD2;
}

export function validateCPFOrCNPJ(XValue: string): boolean {
  const XDigits = XValue.replace(/\D/g, "");
  if (XDigits.length === 0) return true; // empty is valid
  if (XDigits.length <= 11) return validateCPF(XDigits);
  return validateCNPJ(XDigits);
}

export function formatCPFCNPJ(XValue: string): string {
  const XDigits = XValue.replace(/\D/g, "");
  if (XDigits.length <= 11) {
    return XDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return XDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function formatPhone(XValue: string): string {
  const XDigits = XValue.replace(/\D/g, "");
  if (XDigits.length <= 10) {
    return XDigits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return XDigits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}

/** Parse DD/MM/YYYY to YYYY-MM-DD for storage */
export function parseDateBR(XValue: string): string | null {
  const XMatch = XValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!XMatch) return null;
  return `${XMatch[3]}-${XMatch[2]}-${XMatch[1]}`;
}

/** Format ISO date to DD/MM/YYYY */
export function formatDateBR(XValue: string | null | undefined): string {
  if (!XValue) return "";
  const XDate = new Date(XValue);
  if (isNaN(XDate.getTime())) return "";
  const XDay = String(XDate.getDate()).padStart(2, "0");
  const XMonth = String(XDate.getMonth() + 1).padStart(2, "0");
  const XYear = XDate.getFullYear();
  return `${XDay}/${XMonth}/${XYear}`;
}

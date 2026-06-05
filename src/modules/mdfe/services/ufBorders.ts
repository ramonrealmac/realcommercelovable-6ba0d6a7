export const UF_BORDERS: Record<string, string[]> = {
  AC: ["AM", "RO"],
  AL: ["SE", "PE", "BA"],
  AM: ["AC", "RO", "RR", "PA", "MT"],
  AP: ["PA"],
  BA: ["SE", "AL", "PE", "PI", "TO", "GO", "MG", "ES"],
  CE: ["RN", "PB", "PE", "PI"],
  DF: ["GO", "MG"],
  ES: ["RJ", "MG", "BA"],
  GO: ["DF", "TO", "BA", "MG", "MS", "MT"],
  MA: ["PI", "TO", "PA"],
  MG: ["SP", "RJ", "ES", "BA", "GO", "DF", "MS"],
  MS: ["PR", "SP", "MG", "GO", "MT"],
  MT: ["RO", "AM", "PA", "TO", "GO", "MS"],
  PA: ["AP", "RR", "AM", "MT", "TO", "MA"],
  PB: ["RN", "CE", "PE"],
  PE: ["PB", "CE", "PI", "BA", "AL"],
  PI: ["MA", "TO", "BA", "PE", "CE"],
  PR: ["SC", "SP", "MS"],
  RJ: ["SP", "MG", "ES"],
  RN: ["CE", "PB"],
  RO: ["AC", "AM", "MT"],
  RR: ["AM", "PA"],
  RS: ["SC"],
  SC: ["RS", "PR"],
  SE: ["AL", "BA"],
  SP: ["PR", "MS", "MG", "RJ"],
  TO: ["MA", "PI", "BA", "GO", "MT", "PA"]
};

export const areUFsNeighbors = (uf1: string, uf2: string): boolean => {
  const u1 = uf1?.toUpperCase().trim();
  const u2 = uf2?.toUpperCase().trim();
  if (!u1 || !u2) return false;
  if (u1 === u2) return true;
  const borders = UF_BORDERS[u1];
  return borders ? borders.includes(u2) : false;
};

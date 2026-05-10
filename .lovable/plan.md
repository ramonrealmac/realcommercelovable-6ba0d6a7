## Diagnóstico

O ACBrLib rejeita o INI atual porque ele está em um formato "amigável" (estilo ACBrMonitor antigo) que a DLL não interpreta. Como nenhuma chave é reconhecida, a NFe é montada vazia e a validação reclama de:

- `B12/cMunFG` (Código Município FG) inválido → falta `cMunFG` em `[Identificacao]`.
- `C03/xNome`, `C10/cMun`, `C11/xMun` vazios → seção `[Emitente]` usa `RazaoSocial`/`CodigoMunicipio`/`Municipio` em vez de `xNome`/`cMun`/`xMun`.
- `E03/CPF` inválido → CPF `11111111111` reprovado no DV (padrão de homologação correto: `11144477735`).
- `E10/cMun`, `E11/xMun` vazios → mesma causa em `[Destinatario]`.
- `total não esperado, esperado det` → `[Item001]` não é reconhecido como produto, então não há `det` no XML.

Comparativo confirmado em `ExemploAcbrMT/exemplos-mt-acbr-lib/arqs/nfe.ini` (formato aceito pela ACBrLib).

## O que será feito

Reescrita completa de `src/services/gerarIniNfe.ts` para emitir o INI no padrão ACBrLib (mesmas tags do leiaute SEFAZ), mantendo a leitura dos dados já corrigida (empresa via `empresa`, destinatário via `cadastro` por `cadastro_id`, cidade via `cidade.cidade_id`).

### Mapeamento de seções/chaves

| Atual (errado) | Novo (ACBrLib) |
|---|---|
| `[NFe] Versao=4.00` | `[infNFe] versao=4.00` |
| `[Identificacao]` com `Modelo`, `Serie`, `NumDocumento`, `TipoNF`, `DataEmissao`+`HoraEmissao`, `Finalidade`, `TipoEmissao`, `IndicadorConsumidorFinal`, `IndicadorPresenca`, `Ambiente`, `NaturezaOperacao`, `FormatoImpressaoDANFE` | `[Identificacao]` com `cUF`, `cNF` (8 dígitos aleatórios), `natOp`, `mod`, `serie`, `nNF`, `dhEmi=dd/mm/aaaa hh:nn:ss`, `dhSaiEnt`, `tpNF`, `idDest=1`, `tpAmb`, `tpImp` (4 NFCe / 1 NFe), `tpEmis=1`, `finNFe`, `indFinal=1`, `indPres=1`, `procEmi=0`, `verProc` |
| `[Emitente] CNPJ/RazaoSocial/NomeFantasia/InscricaoEstadual/CRT/Logradouro/Numero/Bairro/CEP/UF/CodigoMunicipio/Municipio/Telefone` | `[Emitente] CRT/CNPJCPF/xNome/xFant/IE/IM/xLgr/nro/xBairro/cMun/xMun/cUF/UF/CEP/cPais=1058/xPais=BRASIL/Fone/cMunFG` |
| `[Destinatario] CPF/CNPJ/RazaoSocial/InscricaoEstadual/IndicadorIEDest/Logradouro/...` | `[Destinatario] CNPJCPF/xNome/indIEDest/IE/Email/xLgr/nro/xBairro/cMun/xMun/UF/CEP/cPais=1058/xPais=BRASIL/Fone` (omitir bloco se NFCe sem identificação) |
| `[Item001]` com `CodigoProduto/CodigoBarras/Descricao/NCM/CEST/CFOP/Unidade/Quantidade/ValorUnitario/...` | `[Produto001]` com `cProd/cEAN/cEANTrib/xProd/NCM/CEST/CFOP/uCom/qCom/vUnCom/vProd/uTrib/qTrib/vUnTrib/vFrete/vSeg/vDesc/vOutro/indTot=1` |
| `[ImpostoIcms001] Origem/CSOSN/CST/ModalidadeBC/...` | `[ICMS001] orig/CSOSN` (Simples) ou `CST/modBC/vBC/pICMS/vICMS` (Normal); ST com `modBCST/pMVAST/vBCST/pICMSST/vICMSST` |
| `[ImpostoIpi001]` | `[IPI001] CST/cEnq/vBC/pIPI/vIPI` |
| `[ImpostoPis001]` | `[PIS001] CST/vBC/pPIS/vPIS` |
| `[ImpostoCofins001]` | `[COFINS001] CST/vBC/pCOFINS/vCOFINS` |
| `[Total] ValorTotalProdutos/ValorDesconto/...` | `[Total] vBC/vICMS/vICMSDeson=0/vBCST=0/vST=0/vProd/vFrete/vSeg/vDesc/vII=0/vIPI/vPIS/vCOFINS/vOutro/vNF/vFCP=0/vFCPST=0/vFCPSTRet=0/vIPIDevol=0` |
| `[Pagamento] FormaPagamento001/ValorPagamento001` | `[pag001] tPag/vPag/indPag=0` |
| `[InformacoesAdicionais] InformacoesComplementares` | `[DadosAdicionais] infCpl/infAdFisco` |
| `[NFCe] IdCSC/CSC` | mantido como `[NFCe] IdCSC/CSC` (formato lib) |

### Outras correções

1. **`cMunFG`** obrigatório em `[Identificacao]` — preencher com o `cd_ibge` da cidade do emitente.
2. **`cNF`** — gerar 8 dígitos aleatórios numéricos em cada emissão.
3. **CPF/CNPJ do destinatário** — validar DV antes de incluir; se vier inválido (ex.: `11111111111`), tratar como consumidor não identificado (NFCe) ou abortar (NFe), em vez de mandar para a SEFAZ.
4. **Datas** — usar `dhEmi=dd/mm/aaaa hh:nn:ss` (uma única chave) em vez de `DataEmissao` + `HoraEmissao` separados.
5. **`cUF` do emitente** — derivar dos 2 primeiros dígitos do `cd_ibge` da cidade da empresa (conforme o usuário indicou), eliminando o mapa fixo UF→cUF.
6. Demais campos do destinatário/itens permanecem sendo lidos exclusivamente do `cadastro` (via `cadastro_id`) e da `empresa`, conforme regra já estabelecida.

### Arquivos afetados

- `src/services/gerarIniNfe.ts` — reescrita completa do gerador.
- Nenhuma alteração em `fiscalEmissaoService.ts` (a junção com `cidade` já está OK).
- Nenhuma alteração no worker.

### Validação

Após a reescrita, o INI gerado deve bater seção-a-seção com o exemplo `ExemploAcbrMT/exemplos-mt-acbr-lib/arqs/nfe.ini`. Em homologação, usar CPF `11144477735` para "CONSUMIDOR FINAL" — assim o E03/CPF deixa de ser rejeitado.

const { parentPort, workerData } = require('worker_threads');
const path = require('path');
const ffi = require('ffi-napi');
const ref = require('ref-napi');


const pathDllACBrLibNFe = path.join(__dirname, 'libs/bin/MT/Cdecl/ACBrNFe64.dll');
const eChaveCrypt = '';
const buflength = 256;

const libm = ffi.Library(pathDllACBrLibNFe, {

    NFE_Inicializar: ['int', ['pointer', 'string', 'string']],
    NFE_Finalizar: ['int', ['pointer']],
    NFE_UltimoRetorno: ['int', ['pointer', 'string', 'string']],
    NFE_Nome: ['int',['pointer', 'string','string']],
    NFE_Versao: ['int', ['pointer', 'string','string']],
  
    NFE_ConfigLer: ['int', ['pointer', 'string']],
    NFE_ConfigGravar: ['int', ['pointer', 'string']],
    NFE_ConfigLerValor: ['int',['pointer','string','string','string','string']],
    NFE_ConfigGravarValor: ['int', ['pointer', 'string', 'string', 'string']],
    NFE_ConfigImportar: ['int',['pointer', 'string']],
    NFE_ConfigExportar: ['int',['pointer', 'string','string']],
  
    NFE_ObterCertificados: ['int',['pointer', 'string','string']],
    NFE_CarregarXML: ['int', ['pointer', 'string']], 
    NFE_SalvarPDF: ['int',['pointer', 'string','string']],
  
});


let aloc_sResposta = Buffer.alloc(buflength);
let aloc_esTamanho = ref.alloc('int', buflength);

let handle = ref.alloc('pointer');

libm.NFE_Inicializar(handle, '', eChaveCrypt);
handle = ref.readPointer(handle, 0, buflength);

libm.NFE_ConfigGravarValor(handle, 'Principal', 'TipoResposta', '2');

let nfeversao = libm.NFE_Versao(handle, aloc_sResposta, aloc_esTamanho);
console.log(`versão >>>>>>> ${nfeversao}`);
nfeversao = ref.readCString(aloc_sResposta, 0);

let nfenome = libm.NFE_Nome(handle, aloc_sResposta, aloc_esTamanho);
console.log(`Nome >>>>>>> ${nfenome}`);
nfenome = ref.readCString(aloc_sResposta, 0);

let finaliza = libm.NFE_Finalizar(handle);
console.log(`finalizar >>>>>>>> ${finaliza}`);

parentPort.postMessage({
    nome: nfenome,
    versao: nfeversao
});

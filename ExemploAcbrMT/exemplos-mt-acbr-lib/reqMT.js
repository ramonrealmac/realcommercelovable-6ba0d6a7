const express = require('express');
const app = express();

const path = require('path');
const ffi = require('ffi-napi');
const ref = require('ref-napi');


const pathDllACBrLibNFe = path.join(__dirname, 'libs/bin/MT/Cdecl/ACBrNFe64.dll');
const pathXML = path.join(__dirname, 'arqs/NF.xml');
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


app.get('/pdf', function(req, res){


    let aloc_sResposta = Buffer.alloc(buflength);
    let aloc_esTamanho = ref.alloc('int', buflength);
  
    let handle = ref.alloc('pointer');
  
    libm.NFE_Inicializar(handle, '', eChaveCrypt);
    handle = ref.readPointer(handle, 0, buflength);
  
    libm.NFE_ConfigGravarValor(handle, 'Principal', 'TipoResposta', '2');

    let carregaxml = libm.NFE_CarregarXML(handle, pathXML);
    console.log(`carregar xml >>>>>>> ${carregaxml}`);

    aloc_sResposta = Buffer.alloc(2000000); //2MB
    aloc_esTamanho = ref.alloc('int', aloc_sResposta.length);

    //Gera o binario do PDF
    let gerpdf = libm.NFE_SalvarPDF(handle, aloc_sResposta, aloc_esTamanho);
    console.log(`gerar pdf >>>>>>> ${gerpdf}`);
    let base64PDF = ref.readCString(aloc_sResposta, 0);
  
    let finaliza = libm.NFE_Finalizar(handle);
    console.log(`finalizar >>>>>>>> ${finaliza}`);
  
  
    res.json({
        base64PDF: base64PDF
    });
  
  });


app.get('/info', function(req, res){

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

    res.json({
        nome: nfenome,
        versao: nfeversao
    }); 
  
});
  
  
const PORT = 3333;
app.listen(PORT, ()=>{
    console.log('Rodando na porta: '+ PORT);
});
  
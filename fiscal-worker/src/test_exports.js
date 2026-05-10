
import koffi from 'koffi';
import path from 'path';

const libPath = path.resolve(process.cwd(), 'AcbrDLL/Windows/MT/Cdecl/ACBrNFe64.dll');

try {
    const lib = koffi.load(libPath);
    const functionsToTry = [
        'NFE_ImprimirDANFEPDF',
        'NFE_ImprimirDANFE',
        'NFE_ImprimirDANFEEscPos',
        'NFE_ImprimirEventoPDF',
        'NFE_ImprimirEvento',
        'NFE_GravarPDF',
        'NFE_ObterXml'
    ];

    console.log('Testing exports in ACBrNFe64.dll:');
    for (const f of functionsToTry) {
        try {
            lib.func('int __cdecl ' + f + '(void* handle)');
            console.log(`[FOUND] ${f}`);
        } catch (e) {
            console.log(`[MISSING] ${f}`);
        }
    }
} catch (e) {
    console.error('Failed to load library:', e.message);
}

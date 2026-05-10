
import fs from 'fs';
import path from 'path';

const libPath = path.resolve(process.cwd(), 'AcbrDLL/Windows/MT/Cdecl/ACBrMDFe64.dll');

try {
    const buffer = fs.readFileSync(libPath);
    const content = buffer.toString('utf8');
    
    const searches = ['Imprimir', 'PDF', 'DAMDFe'];
    
    console.log('Searching for symbols in MDFe DLL:');
    for (const s of searches) {
        const regex = new RegExp(`MDFE_[a-zA-Z0-9_]*${s}[a-zA-Z0-9_]*`, 'g');
        const matches = content.match(regex);
        if (matches) {
            const unique = [...new Set(matches)];
            console.log(`[${s}] found ${unique.length} symbols:`, unique.slice(0, 10));
        } else {
            console.log(`[${s}] no symbols found.`);
        }
    }
} catch (e) {
    console.error('Error:', e.message);
}

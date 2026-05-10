
import fs from 'fs';
import path from 'path';

const libPath = path.resolve(process.cwd(), 'AcbrDLL/Windows/MT/Cdecl/ACBrNFe64.dll');

try {
    const buffer = fs.readFileSync(libPath);
    const content = buffer.toString('utf8');
    
    const searches = ['Imprimir', 'PDF', 'DANFE', 'DANFCe'];
    
    console.log('Searching for symbols in DLL:');
    for (const s of searches) {
        const regex = new RegExp(`NFE_[a-zA-Z0-9_]*${s}[a-zA-Z0-9_]*`, 'g');
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

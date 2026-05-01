## Objetivo

Fazer o boneco do `ChatLauncher` (botão flutuante do RealSys) ficar parado a maior parte do tempo e, a cada `empresa.tempo_animacao` segundos (default 5), reproduzir uma curta animação de "piscar + acenar" — uma única vez por ciclo — e voltar ao estado parado.

A animação será feita via **GIF gerado a partir do PNG existente** (sem precisar de novo asset desenhado), combinada com lógica de timer no React para alternar entre imagem estática (PNG) e GIF (animação).

---

## Etapas

### 1. Banco — adicionar parâmetro por empresa
Migration: adicionar coluna `tempo_animacao` em `public.empresa`:
- tipo `integer`
- default `5`
- comentário: "Intervalo em segundos entre execuções da animação do bot RealSys (0 = desativado)"

### 2. Gerar o GIF animado a partir do PNG
Usar Python (Pillow) para criar `src/assets/realsys-bot-animado.gif`:
- Frames base derivados do `realsys-bot.png` (1024x1024 RGBA)
- Sequência de ~12-16 frames combinando:
  - **Piscar**: aplicar uma faixa horizontal escura sobre a região dos olhos por 2 frames (efeito de pálpebra fechando)
  - **Acenar**: rotacionar levemente (±15°) a região do braço/mão (recorte retangular do lado direito da imagem) em 6-8 frames de ida e volta
- Duração total ~1.2s, sem loop infinito (`loop=1` → reproduz uma única vez)
- Otimizado (paleta reduzida, transparência preservada)
- QA: abrir o GIF e validar visualmente cada frame

Observação técnica: como o PNG é uma ilustração já renderizada, a "animação" será obtida por manipulação de pixels (recorte + rotação + máscara dos olhos). Não terá qualidade de animação desenhada à mão, mas dá o efeito de vida pedido. Se o resultado ficar ruim visualmente, fallback é animar via CSS (rotação/escala do PNG inteiro) sem usar GIF.

### 3. Hook reutilizável `useEmpresaParam`
Criar `src/hooks/useEmpresaParam.ts` para ler campos da empresa atual (cache simples por `empresa_id`). Usado para `tempo_animacao` agora e reutilizável depois para outros parâmetros visuais.

### 4. Componente `RealsysBotAvatar` (isolado e reutilizável)
Criar `src/components/chat/RealsysBotAvatar.tsx`:
- Props: `size`, `className`, `intervalSec` (opcional, sobrescreve o da empresa)
- Estado interno `playing: boolean`
- `setInterval` baseado em `tempo_animacao` (segundos). Quando dispara:
  - Troca `<img src>` do PNG estático para o GIF (com cache-buster `?t=${Date.now()}` para forçar replay do GIF)
  - Após a duração da animação (~1300ms), volta para o PNG
- Se `tempo_animacao = 0`, não anima
- Pausa quando `document.hidden` (Page Visibility API) para não consumir CPU em aba inativa
- Limpa timers no unmount

### 5. Integrar no `ChatLauncher`
Substituir o `<img>` direto por `<RealsysBotAvatar />` no `src/components/chat/ChatLauncher.tsx`. Nenhuma outra mudança de comportamento.

### 6. Expor o campo no `EmpresaForm` (opcional, mas coerente com o padrão)
Adicionar input numérico "Tempo de animação do bot (s)" em `src/components/forms/EmpresaForm.tsx`, na seção de parâmetros visuais/personalização, junto com as cores. Default 5, mínimo 0.

---

## Detalhes técnicos

**Migration SQL:**
```sql
ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS tempo_animacao integer NOT NULL DEFAULT 5;
COMMENT ON COLUMN public.empresa.tempo_animacao IS
  'Intervalo (s) entre animações do bot RealSys. 0 desativa.';
```

**Estrutura do componente:**
```tsx
// pseudo
const [playing, setPlaying] = useState(false);
useEffect(() => {
  if (!intervalSec) return;
  const id = setInterval(() => {
    if (document.hidden) return;
    setPlaying(true);
    setTimeout(() => setPlaying(false), 1300);
  }, intervalSec * 1000);
  return () => clearInterval(id);
}, [intervalSec]);

return <img src={playing ? `${gif}?t=${Date.now()}` : png} />;
```

**Geração do GIF (script Python descartável em /tmp):**
- Carrega PNG, identifica caixa aproximada dos olhos e do braço por proporção (não por detecção — coordenadas fixas baseadas no layout do bot)
- Para cada frame, compõe imagem nova com `Image.paste` da região modificada
- Salva com `save_all=True, append_images=[...], duration=80, loop=1, disposal=2, transparency=0`

---

## Arquivos afetados

Criados:
- `supabase/migrations/<timestamp>_empresa_tempo_animacao.sql`
- `src/assets/realsys-bot-animado.gif`
- `src/hooks/useEmpresaParam.ts`
- `src/components/chat/RealsysBotAvatar.tsx`

Editados:
- `src/components/chat/ChatLauncher.tsx`
- `src/components/forms/EmpresaForm.tsx` (adicionar campo no form)
- `src/integrations/supabase/types.ts` (atualizado automaticamente após migration)

---

## Riscos / pontos de atenção

- **Qualidade visual do GIF**: como é gerado por manipulação do PNG, o "aceno" pode ficar artificial. Se ficar ruim, na implementação aplico fallback CSS-only (rotação/scale/keyframes) sem GIF — mesmo comportamento, sem novo asset.
- **Replay do GIF**: navegadores cacheiam GIFs e não reiniciam ao re-renderizar; o cache-buster na URL resolve.
- **Performance**: timer único por instância, pausado em aba oculta.

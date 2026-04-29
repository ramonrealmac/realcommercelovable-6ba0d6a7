# Chat Interno com Assistente IA "RealSys"

Criar um chat persistente acessível por um botão flutuante em toda a aplicação. Mensagens podem ser texto, voz (transcrita) ou anexos (imagens/PDFs com extração de dados). O bot "RealSys" responde via Lovable AI e executa tarefas reais no sistema (abrir formulários, cadastrar clientes, criar orçamentos/pedidos) através de tool calling.

## 1. Banco de Dados (migration)

Tabelas no schema `public`:

- **`chat_conversa`** — uma conversa por usuário/empresa (pode ter várias).
  - `chat_conversa_id bigserial PK`, `user_id uuid`, `empresa_id bigint`, `ds_titulo text`, `dt_criacao`, `dt_atualizacao`.
- **`chat_mensagem`** — histórico.
  - `chat_mensagem_id bigserial PK`, `chat_conversa_id` (FK), `tp_remetente text` (`user`|`assistant`|`system`|`tool`), `ds_conteudo text`, `ds_anexo_url text` (storage), `ds_anexo_tipo text` (mime), `ds_audio_url text`, `tp_acao text` (ação executada), `dados_acao jsonb`, `dt_criacao`.
- **RLS:** apenas o próprio `user_id` lê/grava (`auth.uid() = user_id`).
- **Storage bucket** `chat-anexos` (privado) com policies `auth.uid()::text = (storage.foldername(name))[1]` para isolar arquivos por usuário.

## 2. Edge Function `chat-realsys`

Recebe `{ conversaId, messages, empresaId }` e chama Lovable AI Gateway (`google/gemini-3-flash-preview` por padrão) com:

- **System prompt** explicando que é o RealSys, assistente do ERP, em pt-BR, e que pode usar ferramentas.
- **Tools** (function calling) expostas ao modelo:
  - `abrir_formulario(component)` — abre uma aba (ex.: `cadastro-completo`, `pdv`, `produtos`).
  - `cadastrar_cliente({razao_social, cnpj, telefone, email, endereco...})` — INSERT em `cadastro` com `st_cliente='S'`.
  - `criar_pedido({cadastro_id, itens:[{produto_id, qt, vl_unitario}]})` — INSERT em `movimento` + `movimento_item` e chama `fu_recalcular_pedido`.
  - `buscar_cliente(termo)` / `buscar_produto(termo)` — SELECT com filtro.
  - `extrair_dados_documento({texto})` — usa o próprio LLM para estruturar dados de um documento já parseado (CNPJ, IE, endereço…).
- Streaming SSE de tokens para resposta progressiva.
- Após o modelo emitir `tool_calls`, a function executa a ação no Supabase usando o JWT do usuário (respeitando RLS) e devolve o resultado ao modelo para continuação.

Tratamento de **429** (rate limit) e **402** (créditos) com mensagens claras.

## 3. Edge Function `chat-transcrever`

Recebe áudio (base64) → transcreve via Lovable AI (modelo multimodal Gemini aceita áudio) → retorna texto. Usado tanto para áudios anexados quanto para o botão de microfone.

## 4. Edge Function `chat-extrair-anexo`

Recebe arquivo (imagem/PDF) → envia ao Gemini multimodal pedindo extração estruturada (CNPJ, razão social, endereço, itens de uma nota, etc.) → devolve JSON. O resultado vira contexto para o assistente confirmar com o usuário antes de cadastrar.

## 5. Frontend

### Avatar do RealSys
Gerar via Lovable AI (`google/gemini-2.5-flash-image`) **uma vez** durante o desenvolvimento — robozinho amigável usando as cores da logomarca (`logo_realsys.jpg`). Salvar em `src/assets/realsys-bot.png`.

### Componentes novos
- `src/components/chat/ChatLauncher.tsx` — botão flutuante (canto inferior direito) com badge de mensagens não lidas. Renderizado dentro de `AppContent` (só aparece após login + empresa selecionada).
- `src/components/chat/ChatPanel.tsx` — painel lateral/drawer (usa `Sheet` do shadcn) com lista de mensagens, input, botão de anexo, botão de microfone (reutiliza `useSpeechRecognition`) e botão "gravar áudio" (envia o blob).
- `src/components/chat/ChatMessage.tsx` — bolha de mensagem com markdown (`react-markdown`), preview de anexo, player de áudio, e cards de "ação executada" (ex.: "✓ Cliente ACME criado — abrir cadastro").
- `src/components/chat/useChatActions.ts` — hook que conecta as tool calls retornadas pela edge function ao `openTab` do `AppContext` quando a ação é `abrir_formulario` (a UI precisa executar isso, não o backend).

### Fluxo de envio
1. Usuário digita / fala / anexa.
2. Anexo → upload em `chat-anexos/{user_id}/...` → URL salva em `chat_mensagem`.
3. Áudio → `chat-transcrever` → texto vira a mensagem (áudio fica anexado).
4. Documento → `chat-extrair-anexo` → JSON entra no contexto da próxima requisição ao assistente.
5. `chat-realsys` é chamado com histórico completo → resposta em streaming → tool calls executadas → mensagem final renderizada.

## 6. Segurança
- Edge functions validam JWT do usuário e usam o token dele para todas as queries (RLS aplica).
- Tools que escrevem em tabelas com `empresa_id` recebem o `empresaId` do contexto da requisição (não confiar em valor que o LLM "inventou").
- Tamanho máx. anexo: 10 MB. Tipos permitidos: imagem, PDF, áudio.

## 7. Detalhes técnicos

```text
TopBar ─┐
        ├─ AppContent
TabBar ─┤      └─ ChatLauncher (fixed bottom-right)
SideBar ┘            └─ ChatPanel (Sheet)
                           ├─ ChatMessage[]
                           └─ Input + anexo + mic + audio-record
```

Tool-call loop na edge function:
```text
client → edge → AI Gateway
                  ↓ tool_calls
              executa no Supabase (RLS)
                  ↓ tool_results
              AI Gateway → resposta final → SSE → client
```

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<ts>_chat_realsys.sql` (tabelas + RLS + bucket)
- `supabase/functions/chat-realsys/index.ts`
- `supabase/functions/chat-transcrever/index.ts`
- `supabase/functions/chat-extrair-anexo/index.ts`
- `src/assets/realsys-bot.png` (gerado)
- `src/components/chat/ChatLauncher.tsx`
- `src/components/chat/ChatPanel.tsx`
- `src/components/chat/ChatMessage.tsx`
- `src/components/chat/useChatActions.ts`
- `src/components/chat/chatService.ts` (wrapper das chamadas)

**Editar:**
- `src/pages/Index.tsx` — montar `<ChatLauncher />` dentro de `AppContent`.
- `package.json` — adicionar `react-markdown`.

## Pontos de confirmação

1. **Escopo das ações automáticas:** comecei com **cadastrar cliente, abrir formulários, criar pedido/orçamento, buscar cliente/produto**. Posso adicionar fornecedor, produto, condição de pagamento etc. depois.
2. **Persistência do histórico:** mantenho histórico completo no banco (sem expirar). Ok?
3. **Avatar:** gero um robozinho com as cores da logo. Se tiver preferência (mais sério, mais cartoon), me avise.

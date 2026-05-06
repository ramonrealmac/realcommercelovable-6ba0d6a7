# Fiscal Worker

Módulo independente (serviço de background em Node.js) desenhado para agir como uma interface de integração entre a aplicação web (via Supabase) e bibliotecas dinâmicas (DLLs) fiscais nativas em ambiente Windows. 

O objetivo principal deste projeto é receber as requisições enviadas pela aplicação React via banco de dados (`fiscal_evento`), formatá-las, enviar para a biblioteca nativa, aguardar o retorno e atualizar a mesma tabela no Supabase.

Toda a troca de dados entre os sistemas é feita exclusivamente via **JSON**.

## Arquitetura e Bibliotecas
- Node.js (Módulo ES6)
- `@supabase/supabase-js`: Comunicação com o backend (Postgres e Realtime)
- `koffi`: FFI (Foreign Function Interface) veloz para carregar DLLs nativas em C/C++ (Delphi/Lazarus etc)
- `winston`: Geração de logs estruturados no console
- `dotenv`: Gerenciamento de variáveis de ambiente locais

## Estrutura do Banco de Dados
A aplicação depende da tabela `fiscal_evento` no Supabase com o recurso de `Realtime` ativo e configurada com `REPLICA IDENTITY FULL`. Essa tabela age como uma Fila de Mensageria (Message Broker).

Status trabalhados:
- `PENDENTE`: Inserido pela interface web aguardando processamento.
- `PROCESSANDO`: O Worker capturou a linha e está chamando a DLL.
- `CONCLUIDO`: O processamento foi finalizado com sucesso. O JSON retornado fica no campo `resposta`.
- `ERRO`: Acorreu uma falha. A descrição do erro fica em `mensagem_erro`.

## Como Configurar e Rodar Localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Crie seu arquivo de ambiente:
   Copie o arquivo `.env.example` para `.env` e preencha com as chaves corretas:
   ```ini
   SUPABASE_URL="https://seu-projeto.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="sua_chave_secreta_service_role"
   FISCAL_LIB_PATH="C:/Caminho/Absoluto/Para/A/Sua/Biblioteca64.dll"
   ```
   > **Aviso:** Nunca exponha sua `SERVICE_ROLE_KEY` para o frontend. Esse worker é uma aplicação de Backend Privado.

3. Inicie o Worker:
   ```bash
   npm start
   ```

Assim que o Worker iniciar, ele fará uma varredura por registros pendentes ou travados no banco de dados. Após processá-los, ele ficará "escutando" via sockets em tempo real. Qualquer `INSERT` novo na tabela de eventos será detectado e processado no mesmo milissegundo.

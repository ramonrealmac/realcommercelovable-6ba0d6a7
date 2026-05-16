# Guia de Engenharia: ERP RealSys (v1.10.0)

Este documento descreve como utilizar as novas ferramentas de arquitetura e qualidade implementadas durante a modernização do sistema.

## 🧪 1. Testes Automatizados (Vitest)
Implementamos uma suíte de testes unitários para garantir que a lógica de negócios (como cálculos de pedidos e validações fiscais) não quebre no futuro.

### Como executar:
No terminal do seu computador (na pasta do projeto), você pode usar os seguintes comandos:

*   **Execução Única**: `npx vitest run` (Roda todos os testes e mostra o resultado).
*   **Modo Watch (Desenvolvimento)**: `npx vitest` (Fica monitorando os arquivos. Se você mudar uma função, ele roda o teste automaticamente).
*   **Interface Visual**: `npx vitest --ui` (Abre uma página no navegador muito bonita para você ver os testes passando).

> [!TIP]
> Os arquivos de teste estão localizados em `src/services/api/*.test.ts`. Use-os como modelo para criar novos testes.

---

## 🏗️ 2. Service Layer (Camada de Serviços)
Agora o sistema possui uma camada intermediária entre a UI e o Banco de Dados. Isso isola a complexidade e facilita a manutenção.

*   **Localização**: `src/services/api/`
*   **Serviços Disponíveis**:
    *   `PedidoService`: Controle atômico de pedidos e status.
    *   `ClienteService`: Validação rigorosa (Zod) e busca otimizada.
    *   `BaseService`: Abstração comum para qualquer nova tabela.

### Como usar em um componente:
```typescript
import { pedidoService } from "@/services/api/PedidoService";

// Exemplo: Alterar status de um pedido
await pedidoService.alterarStatus(123, 'F', usuarioId);
```

---

## ⚡ 3. Cache Inteligente (TanStack Query)
O `useCrudController` agora gerencia cache automaticamente.

*   **O que mudou?** Quando você navega entre abas, o sistema não faz um novo "loading" se os dados já foram carregados nos últimos 5 minutos.
*   **Invalidação**: Ao salvar ou excluir um registro, o sistema avisa o cache para se atualizar (`queryClient.invalidateQueries`). Isso garante que todas as telas do sistema vejam o dado novo instantaneamente.

---

## 🛡️ 4. Proteção contra Tela Branca (Error Boundary)
Se o código de algum componente falhar, o sistema não "morre" mais.

*   O componente `ErrorBoundary.tsx` captura o erro e exibe uma tela de recuperação amigável.
*   Em desenvolvimento, ele exibe o log do erro na tela para facilitar o debug.

---

## 📜 5. Histórico de Versões no Banco
Tudo o que fizemos está documentado na tabela `public.sistema_versoes`. Você pode consultar via SQL:

```sql
SELECT * FROM sistema_versoes ORDER BY versao DESC;
```

---

## 🛠️ 6. Outros Comandos Úteis
*   **Verificar Tipagem**: `npx tsc --noEmit` (Verifica se existem erros de TypeScript no projeto).
*   **Linter (Limpeza)**: `npm run lint` (Identifica código mal formatado ou variáveis não utilizadas).

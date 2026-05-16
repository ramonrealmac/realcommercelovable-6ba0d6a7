import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { customerTools } from './tools/customerTools.js';
import { productTools } from './tools/productTools.js';
import { orderTools } from './tools/orderTools.js';
import { fiscalTools } from './tools/fiscalTools.js';
import { companyTools } from './tools/companyTools.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

class RealCommerceServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'realcommerce-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Customer Tools
        {
          name: 'list_customers',
          description: 'Lista clientes do sistema com filtro opcional',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nome, Fantasia ou CPF/CNPJ' },
              limit: { type: 'number', default: 10 }
            }
          }
        },
        {
          name: 'get_customer_details',
          description: 'Obtém detalhes completos de um cliente',
          inputSchema: {
            type: 'object',
            properties: {
              customer_id: { type: 'number' }
            },
            required: ['customer_id']
          }
        },
        {
          name: 'lookup_cnpj',
          description: 'Consulta dados de uma empresa pelo CNPJ (via ReceitaWS/Sintegra)',
          inputSchema: {
            type: 'object',
            properties: {
              cnpj: { type: 'string', description: 'CNPJ apenas números' }
            },
            required: ['cnpj']
          }
        },
        {
          name: 'create_customer',
          description: 'Cria ou atualiza um cadastro de cliente/fornecedor',
          inputSchema: {
            type: 'object',
            properties: {
              customer_data: { type: 'object', description: 'Dados do cadastro' }
            },
            required: ['customer_data']
          }
        },
        {
          name: 'import_customer_xml',
          description: 'Cria ou atualiza um cadastro a partir de um XML de NFe',
          inputSchema: {
            type: 'object',
            properties: {
              xml_content: { type: 'string', description: 'Conteúdo do XML da NFe' }
            },
            required: ['xml_content']
          }
        },
        // Product Tools
        {
          name: 'list_products',
          description: 'Lista produtos e estoque',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nome ou Código' },
              limit: { type: 'number', default: 10 }
            }
          }
        },
        // Order Tools
        {
          name: 'create_order',
          description: 'Cria um novo pedido ou orçamento no sistema',
          inputSchema: {
            type: 'object',
            properties: {
              customer_id: { type: 'number' },
              items: { 
                type: 'array', 
                items: { 
                  type: 'object',
                  properties: {
                    produto_id: { type: 'number' },
                    qt_item: { type: 'number' },
                    vl_unit: { type: 'number' }
                  }
                }
              },
              order_data: { type: 'object' }
            },
            required: ['customer_id', 'items']
          }
        },
        {
          name: 'list_payment_conditions',
          description: 'Lista as formas/condições de pagamento disponíveis no sistema',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nome da condição' },
              limit: { type: 'number', default: 20 }
            }
          }
        },
        // Fiscal Tools
        {
          name: 'finalize_sale_pdv',
          description: 'Finaliza uma venda no PDV (muda status para Recebido)',
          inputSchema: {
            type: 'object',
            properties: {
              movement_id: { type: 'number' },
              payments: { type: 'array' }
            },
            required: ['movement_id']
          }
        },
        {
          name: 'emit_fiscal_document',
          description: 'Emite documento fiscal (NFe ou NFCe) para um movimento',
          inputSchema: {
            type: 'object',
            properties: {
              movement_id: { type: 'number' },
              model: { type: 'number', enum: [55, 65], description: '55=NFe, 65=NFCe' }
            },
            required: ['movement_id', 'model']
          }
        },
        {
          name: 'suggest_return_cfop',
          description: 'Sugere o CFOP de devolução invertendo o CFOP de origem',
          inputSchema: {
            type: 'object',
            properties: {
              cfop_origem: { type: 'string', description: 'CFOP original da nota' }
            },
            required: ['cfop_origem']
          }
        },
        {
          name: 'get_company_config',
          description: 'Obtém as configurações da empresa, incluindo parâmetros de IA',
          inputSchema: {
            type: 'object',
            properties: {
              empresa_id: { type: 'number', description: 'ID da empresa (opcional, retorna a primeira se vazio)' }
            }
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_customers': return await customerTools.list_customers(args as any);
          case 'get_customer_details': return await customerTools.get_customer_details(args as any);
          case 'lookup_cnpj': return await customerTools.lookup_cnpj(args as any);
          case 'create_customer': return await customerTools.create_customer(args as any);
          case 'import_customer_xml': return await customerTools.import_customer_xml(args as any);
          
          case 'list_products': return await productTools.list_products(args as any);
          
          case 'create_order': return await orderTools.create_order(args as any);
          case 'list_payment_conditions': return await orderTools.list_payment_conditions(args as any);
          
          case 'finalize_sale_pdv': return await fiscalTools.finalize_sale_pdv(args as any);
          case 'emit_fiscal_document': return await fiscalTools.emit_fiscal_document(args as any);
          case 'suggest_return_cfop': return await fiscalTools.suggest_return_cfop(args as any);
          case 'get_company_config': return await companyTools.get_company_config(args as any);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Ferramenta não encontrada: ${name}`);
        }
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        return {
          content: [{ type: 'text', text: `Erro: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RealCommerce MCP server running on stdio');
  }
}

const server = new RealCommerceServer();
server.run().catch(console.error);

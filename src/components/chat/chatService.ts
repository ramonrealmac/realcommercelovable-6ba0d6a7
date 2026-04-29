import { supabase } from "@/integrations/supabase/client";

export type ChatMsgRow = {
  chat_mensagem_id: number;
  chat_conversa_id: number;
  user_id: string;
  tp_remetente: "user" | "assistant" | "system" | "tool";
  ds_conteudo: string | null;
  ds_anexo_url: string | null;
  ds_anexo_tipo: string | null;
  ds_audio_url: string | null;
  tp_acao: string | null;
  dados_acao: any;
  dt_criacao: string;
};

export async function ensureConversa(userId: string, empresaId: number): Promise<number> {
  const sb: any = supabase;
  const { data: existing } = await sb
    .from("chat_conversa")
    .select("chat_conversa_id")
    .eq("user_id", userId)
    .order("dt_atualizacao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.chat_conversa_id) return existing.chat_conversa_id;
  const { data, error } = await sb
    .from("chat_conversa")
    .insert({ user_id: userId, empresa_id: empresaId, ds_titulo: "Conversa com RealSys" })
    .select("chat_conversa_id")
    .single();
  if (error) throw error;
  return data.chat_conversa_id;
}

export async function listMessages(conversaId: number): Promise<ChatMsgRow[]> {
  const sb: any = supabase;
  const { data } = await sb
    .from("chat_mensagem")
    .select("*")
    .eq("chat_conversa_id", conversaId)
    .order("dt_criacao", { ascending: true });
  return (data || []) as ChatMsgRow[];
}

export async function insertMessage(row: Omit<ChatMsgRow, "chat_mensagem_id" | "dt_criacao">): Promise<ChatMsgRow> {
  const sb: any = supabase;
  const { data, error } = await sb.from("chat_mensagem").insert(row).select("*").single();
  if (error) throw error;
  return data as ChatMsgRow;
}

export async function uploadAttachment(userId: string, file: Blob, filename: string): Promise<{ path: string; signedUrl: string }> {
  const sb: any = supabase;
  const path = `${userId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await sb.storage.from("chat-anexos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = await sb.storage.from("chat-anexos").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, signedUrl: data?.signedUrl || "" };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function callRealsys(payload: { messages: any[]; empresaId: number }) {
  const { data, error } = await (supabase as any).functions.invoke("chat-realsys", { body: payload });
  if (error) throw new Error(error.message || "Falha no chat");
  return data as { content: string; ui_actions: any[]; tool_results: any[]; error?: string };
}

export async function transcreverAudio(blob: Blob): Promise<string> {
  const b64 = await blobToBase64(blob);
  const { data, error } = await (supabase as any).functions.invoke("chat-transcrever", {
    body: { audio_base64: b64, mime: blob.type || "audio/webm" },
  });
  if (error) throw new Error(error.message || "Falha na transcrição");
  return (data as any)?.texto || "";
}

export async function extrairAnexo(blob: Blob, mime: string): Promise<string> {
  const b64 = await blobToBase64(blob);
  const { data, error } = await (supabase as any).functions.invoke("chat-extrair-anexo", {
    body: { file_base64: b64, mime },
  });
  if (error) throw new Error(error.message || "Falha na extração");
  return (data as any)?.texto || "";
}

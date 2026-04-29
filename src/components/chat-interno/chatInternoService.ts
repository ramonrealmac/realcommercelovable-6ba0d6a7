import { supabase } from "@/integrations/supabase/client";

export type ChatSala = {
  chat_sala_id: number;
  tp_sala: "D" | "G";
  ds_nome: string | null;
  empresa_id: number | null;
  criado_por: string;
  dt_criacao: string;
  dt_atualizacao: string;
};

export type ChatMembro = {
  chat_sala_membro_id: number;
  chat_sala_id: number;
  user_id: string;
  dt_entrada: string;
  dt_ultima_leitura: string;
};

export type ChatMensagem = {
  chat_sala_mensagem_id: number;
  chat_sala_id: number;
  user_id: string;
  ds_conteudo: string | null;
  ds_anexo_url: string | null;
  ds_anexo_tipo: string | null;
  ds_audio_url: string | null;
  dt_criacao: string;
};

export type Profile = {
  id: string;
  nm_usuario: string | null;
  ds_login: string | null;
  ds_foto: string | null;
  email: string | null;
};

const sb: any = supabase;

/* ------- Salas ------- */
export async function listarMinhasSalas(userId: string): Promise<{
  salas: ChatSala[];
  membrosPorSala: Record<number, ChatMembro[]>;
  ultimaLeituraPorSala: Record<number, string>;
}> {
  const { data: minhas } = await sb
    .from("chat_sala_membro")
    .select("chat_sala_id, dt_ultima_leitura")
    .eq("user_id", userId);
  const ids = (minhas || []).map((m: any) => m.chat_sala_id);
  if (ids.length === 0) return { salas: [], membrosPorSala: {}, ultimaLeituraPorSala: {} };
  const { data: salas } = await sb
    .from("chat_sala")
    .select("*")
    .in("chat_sala_id", ids)
    .order("dt_atualizacao", { ascending: false });
  const { data: membros } = await sb
    .from("chat_sala_membro")
    .select("*")
    .in("chat_sala_id", ids);
  const membrosPorSala: Record<number, ChatMembro[]> = {};
  (membros || []).forEach((m: ChatMembro) => {
    (membrosPorSala[m.chat_sala_id] ||= []).push(m);
  });
  const ultimaLeituraPorSala: Record<number, string> = {};
  (minhas || []).forEach((m: any) => {
    ultimaLeituraPorSala[m.chat_sala_id] = m.dt_ultima_leitura;
  });
  return { salas: (salas || []) as ChatSala[], membrosPorSala, ultimaLeituraPorSala };
}

export async function criarSala(
  criadoPor: string,
  empresaId: number | null,
  tipo: "D" | "G",
  nome: string | null,
  membrosUserIds: string[],
): Promise<number> {
  // DM: tenta achar sala existente entre os 2
  if (tipo === "D" && membrosUserIds.length === 1) {
    const outro = membrosUserIds[0];
    const { data: minhas } = await sb
      .from("chat_sala_membro")
      .select("chat_sala_id")
      .eq("user_id", criadoPor);
    const ids = (minhas || []).map((m: any) => m.chat_sala_id);
    if (ids.length) {
      const { data: doOutro } = await sb
        .from("chat_sala_membro")
        .select("chat_sala_id")
        .eq("user_id", outro)
        .in("chat_sala_id", ids);
      const candidatos = (doOutro || []).map((m: any) => m.chat_sala_id);
      if (candidatos.length) {
        const { data: dms } = await sb
          .from("chat_sala")
          .select("chat_sala_id")
          .eq("tp_sala", "D")
          .in("chat_sala_id", candidatos);
        if (dms && dms.length) return dms[0].chat_sala_id;
      }
    }
  }
  const { data: sala, error } = await sb
    .from("chat_sala")
    .insert({ tp_sala: tipo, ds_nome: nome, empresa_id: empresaId, criado_por: criadoPor })
    .select("chat_sala_id")
    .single();
  if (error) throw error;
  const salaId = sala.chat_sala_id;
  const linhas = [criadoPor, ...membrosUserIds.filter((u) => u !== criadoPor)].map((u) => ({
    chat_sala_id: salaId,
    user_id: u,
  }));
  const { error: e2 } = await sb.from("chat_sala_membro").insert(linhas);
  if (e2) throw e2;
  return salaId;
}

export async function sairDaSala(salaId: number, userId: string) {
  await sb.from("chat_sala_membro").delete().eq("chat_sala_id", salaId).eq("user_id", userId);
}

/* ------- Mensagens ------- */
export async function listarMensagens(salaId: number): Promise<ChatMensagem[]> {
  const { data } = await sb
    .from("chat_sala_mensagem")
    .select("*")
    .eq("chat_sala_id", salaId)
    .order("dt_criacao", { ascending: true })
    .limit(500);
  return (data || []) as ChatMensagem[];
}

export async function enviarMensagem(row: Omit<ChatMensagem, "chat_sala_mensagem_id" | "dt_criacao">) {
  const { data, error } = await sb.from("chat_sala_mensagem").insert(row).select("*").single();
  if (error) throw error;
  return data as ChatMensagem;
}

export async function marcarComoLido(salaId: number, userId: string) {
  await sb
    .from("chat_sala_membro")
    .update({ dt_ultima_leitura: new Date().toISOString() })
    .eq("chat_sala_id", salaId)
    .eq("user_id", userId);
}

export async function contarNaoLidas(
  salaId: number,
  userId: string,
  desde: string,
): Promise<number> {
  const { count } = await sb
    .from("chat_sala_mensagem")
    .select("chat_sala_mensagem_id", { count: "exact", head: true })
    .eq("chat_sala_id", salaId)
    .neq("user_id", userId)
    .gt("dt_criacao", desde);
  return count || 0;
}

/* ------- Profiles ------- */
export async function listarProfiles(excetoUserId?: string): Promise<Profile[]> {
  const { data } = await sb
    .from("profiles")
    .select("id, nm_usuario, ds_login, ds_foto, email")
    .order("nm_usuario", { ascending: true });
  let arr = (data || []) as Profile[];
  if (excetoUserId) arr = arr.filter((p) => p.id !== excetoUserId);
  return arr;
}

export async function getProfilesByIds(ids: string[]): Promise<Record<string, Profile>> {
  if (!ids.length) return {};
  const { data } = await sb
    .from("profiles")
    .select("id, nm_usuario, ds_login, ds_foto, email")
    .in("id", ids);
  const map: Record<string, Profile> = {};
  (data || []).forEach((p: Profile) => (map[p.id] = p));
  return map;
}

/* ------- Anexos (reaproveita bucket chat-anexos) ------- */
export async function uploadChatAnexo(
  userId: string,
  file: Blob,
  filename: string,
): Promise<{ path: string; signedUrl: string }> {
  const path = `${userId}/interno/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await sb.storage.from("chat-anexos").upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = await sb.storage.from("chat-anexos").createSignedUrl(path, 60 * 60 * 24 * 7);
  return { path, signedUrl: data?.signedUrl || "" };
}

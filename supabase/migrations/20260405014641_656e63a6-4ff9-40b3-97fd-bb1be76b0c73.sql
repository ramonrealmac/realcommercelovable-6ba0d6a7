
DO $$
DECLARE
  v_perfil_id bigint;
BEGIN
  -- Insert default empresa if not exists
  INSERT INTO empresa (empresa_id, razao_social, nome_fantasia, cnpj)
  VALUES (1, 'Empresa Padrão', 'Empresa Padrão', '00000000000000')
  ON CONFLICT (empresa_id) DO NOTHING;

  -- Link user to empresa
  INSERT INTO empresa_usuario (empresa_id, user_id, fl_excluido)
  VALUES (1, 'bc04c871-7f34-41b2-952d-c547bd039c9f', false);

  -- Create admin profile
  INSERT INTO perfil (empresa_id, nm_perfil, fl_administrador, fl_excluido)
  VALUES (1, 'Administrador', true, false)
  RETURNING perfil_id INTO v_perfil_id;

  -- Link user to admin profile
  INSERT INTO perfil_usuario (empresa_id, perfil_id, user_id, fl_excluido)
  VALUES (1, v_perfil_id, 'bc04c871-7f34-41b2-952d-c547bd039c9f', false);
END;
$$;

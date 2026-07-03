-- 130: dois fixes no set_numeracao_cp (numeracao manual de CP, tela de Rompimentos).
-- Aplicada via MCP em xbdvyvvxvzmcosnekmfv (02/07/2026). Registro para o repo.
-- (a) Guard: is_tenant_writer() era chamado SEM argumento (mesma heranca GEOMAT corrigida na 129
--     para atribuir_numeracao_cp_lote) -> "function is_tenant_writer() does not exist" em toda
--     chamada; mascarado pelo fallback de metadata do front (rompimento.ts).
-- (b) Escopo do check de duplicidade: validava por (tenant, concretagem), mas a 128 trocou o
--     UNIQUE para (tenant, numeracao) -- numero repetido entre concretagens passava no check e
--     estourava no indice ux_corpos_prova_numeracao_lab_tenant com erro cru de constraint.
--     Alinha o check ao escopo do laboratorio, com mensagem amigavel.
-- Verificacao pos-apply: chamada sem claims JWT levanta 'sem permissao para alterar numeracao
-- do CP' (linha do guard novo), nao mais o erro de assinatura. CREATE OR REPLACE preserva grants.

create or replace function public.set_numeracao_cp(p_id uuid, p_numeracao text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cp public.corpos_prova%rowtype;
  v_num text := nullif(trim(p_numeracao), '');
  v_tenant uuid := public.current_tenant_id();
begin
  if v_tenant is null or not public.is_tenant_writer(v_tenant) then
    raise exception 'sem permissao para alterar numeracao do CP';
  end if;
  if v_num is not null and char_length(v_num) > 25 then
    raise exception 'numeracao_lab deve ter no maximo 25 caracteres';
  end if;
  select * into v_cp from public.corpos_prova
   where id = p_id and tenant_id = v_tenant and deleted_at is null for update;
  if not found then raise exception 'CP nao encontrado'; end if;
  if v_num is not null and exists (
    select 1 from public.corpos_prova c
     where c.tenant_id = v_cp.tenant_id and c.id <> v_cp.id
       and c.deleted_at is null and c.numeracao_lab = v_num
  ) then
    raise exception 'numeracao_lab ja utilizada neste laboratorio';
  end if;
  update public.corpos_prova set numeracao_lab = v_num, updated_at = now() where id = p_id;
end; $function$;

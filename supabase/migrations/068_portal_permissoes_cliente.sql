-- 068 (E2): papéis/permissões do usuário do portal. permissivo por padrão (null/unset = liberado; só false bloqueia).
alter table public.members add column if not exists portal_permissoes jsonb;

create or replace function public.current_member_pode(p_feature text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select case
      when coalesce(m.role, '') <> 'cliente' then true
      when m.portal_permissoes is null then true
      when m.portal_permissoes ->> p_feature is null then true
      else coalesce((m.portal_permissoes ->> p_feature)::boolean, true)
    end
    from public.members m where m.auth_id = auth.uid() and m.active and m.deleted_at is null
    order by m.is_selected desc limit 1
  ), true);
$$;
revoke all on function public.current_member_pode(text) from public;
grant execute on function public.current_member_pode(text) to authenticated;

-- enforcement aditivo em cancelar_programacao_cliente (065) e postar_comentario_portal (066) — corpos atualizados via MCP.
-- (este arquivo é referência; o conteúdo completo das duas funções com os checks foi aplicado via apply_migration.)

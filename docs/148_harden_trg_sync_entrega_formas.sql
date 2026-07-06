-- 148_harden_trg_sync_entrega_formas
revoke all on function public.trg_sync_entrega_formas() from public, anon;

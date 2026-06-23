// Escopo por obra (enforcement no app — espelha public.member_can_access_work):
// linhas em member_obras para o membro atual = acesso RESTRITO àquelas obras;
// nenhuma linha = acesso irrestrito dentro do tenant. O RLS continua garantindo o
// isolamento por tenant; este hook aplica o recorte fino por obra nas telas do Concreto.
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type WorkScope = { loading: boolean; restricted: boolean; workIds: string[] };

export function useWorkScope(): WorkScope {
  const { member, demo } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['work-scope', member?.id ?? 'none'],
    enabled: !demo && !!member?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('member_obras')
        .select('work_id')
        .eq('member_id', member!.id)
        .is('deleted_at', null);
      if (error) throw error;
      return ((rows ?? []) as Array<{ work_id: string }>).map((r) => String(r.work_id));
    },
  });
  const workIds = data ?? [];
  return { loading: isLoading, restricted: workIds.length > 0, workIds };
}

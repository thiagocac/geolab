import { Card } from './Card';
export function LoadingState() { return <Card className="p-6 space-y-3"><div className="skeleton h-5 w-2/5" /><div className="skeleton h-3 w-full" /><div className="skeleton h-3 w-11/12" /><div className="skeleton h-3 w-9/12" /></Card>; }
export function EmptyState() { return <Card className="p-8 text-center text-sm text-slate-600 dark:text-slate-300">Nenhum registro encontrado.</Card>; }
export function ErrorState({ message }: { message: string }) { return <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/40 p-5 text-red-800 dark:text-red-300">{message}</Card>; }

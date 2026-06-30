type TracoOpt = { value: string; label: string; fck?: number | null; work_id?: string | null; client_id?: string | null };

function fmt(t: TracoOpt): string {
  return t.fck != null ? `${t.label} · FCK ${t.fck}` : t.label;
}

// Agrupa as opcoes de traco por origem na cadeia de escopo: desta obra > da construtora > catalogo do lab.
export function TracoOptions({ tracos, workId, clientId }: { tracos: TracoOpt[]; workId?: string | null; clientId?: string | null }) {
  const ehDestaObra = (t: TracoOpt) => !!t.work_id && t.work_id === workId;
  const obra = tracos.filter(ehDestaObra);
  const constr = tracos.filter((t) => !ehDestaObra(t) && !!t.client_id && t.client_id === clientId);
  const catalogo = tracos.filter((t) => !t.work_id && !t.client_id);
  const usados = new Set<TracoOpt>([...obra, ...constr, ...catalogo]);
  const outros = tracos.filter((t) => !usados.has(t));
  return (
    <>
      {obra.length ? <optgroup label="Desta obra">{obra.map((t) => <option key={t.value} value={t.value}>{fmt(t)}</option>)}</optgroup> : null}
      {constr.length ? <optgroup label="Da construtora">{constr.map((t) => <option key={t.value} value={t.value}>{fmt(t)}</option>)}</optgroup> : null}
      {catalogo.length ? <optgroup label="Catálogo do lab">{catalogo.map((t) => <option key={t.value} value={t.value}>{fmt(t)}</option>)}</optgroup> : null}
      {outros.length ? <optgroup label="Outros traços">{outros.map((t) => <option key={t.value} value={t.value}>{fmt(t)}</option>)}</optgroup> : null}
    </>
  );
}

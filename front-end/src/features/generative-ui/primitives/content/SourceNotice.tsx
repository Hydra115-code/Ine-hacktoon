import { cleanGeneratedCopy } from "./clean-generated-copy";

interface SourceNoticeProps {
  institution: string;
  label: string;
  url?: string;
  updatedAt?: string;
}

export function SourceNotice({ institution, label, url, updatedAt }: SourceNoticeProps) {
  return (
    <aside aria-label="Fuente de los datos" className="ui-evidence-notice ui-evidence-notice--source">
      <strong>Fuente</strong>
      <span>{cleanGeneratedCopy(institution)}: {cleanGeneratedCopy(label)}</span>
      {updatedAt ? <small>Actualización: {cleanGeneratedCopy(updatedAt)}</small> : null}
      {url ? <a href={url} rel="noreferrer" target="_blank">Consultar fuente oficial</a> : null}
    </aside>
  );
}

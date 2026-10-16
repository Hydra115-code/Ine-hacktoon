interface MethodologyNoticeProps {
  children: string;
  caveats?: readonly string[];
  title?: string;
}

export function MethodologyNotice({ children, caveats = [], title = "Cómo se calculó" }: MethodologyNoticeProps) {
  return (
    <details className="ui-evidence-notice ui-evidence-notice--methodology">
      <summary>{title}</summary>
      <p>{children}</p>
      {caveats.length > 0 ? (
        <ul aria-label="Advertencias metodológicas">
          {caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
        </ul>
      ) : null}
    </details>
  );
}

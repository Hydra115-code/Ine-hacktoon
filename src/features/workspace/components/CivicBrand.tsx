interface CivicBrandProps {
  context?: "header" | "access";
}

export function CivicBrand({ context = "header" }: CivicBrandProps) {
  return (
    <span className="civic-brand" data-context={context}>
      <span className="civic-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 40 40">
          <path d="M8 28.5V20m8 8.5V13m8 15.5V17m8 11.5V8" />
          <circle cx="8" cy="16" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <circle cx="24" cy="13" r="2.5" />
          <circle cx="32" cy="4" r="2.5" />
        </svg>
      </span>
      <span className="civic-brand__copy">
        <strong>INE</strong>
        <small>Datos para comprender</small>
      </span>
    </span>
  );
}

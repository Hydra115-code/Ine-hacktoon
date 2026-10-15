interface CivicBrandProps {
  context?: "header" | "access";
}

export function CivicBrand({ context = "header" }: CivicBrandProps) {
  return (
    <span className="civic-brand" data-context={context}>
      <span className="civic-brand__copy">
        <strong>INE</strong>
      </span>
    </span>
  );
}

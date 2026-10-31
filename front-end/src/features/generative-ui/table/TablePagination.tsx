interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ page, totalPages, totalRows, onPageChange }: TablePaginationProps) {
  const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
    if (totalPages <= 5) return index + 1;
    const start = Math.min(Math.max(page - 2, 1), totalPages - 4);
    return start + index;
  });

  return (
    <nav aria-label="Paginación de la tabla" className="ui-table__pagination">
      <p>{totalRows} {totalRows === 1 ? "resultado" : "resultados"}</p>
      {totalPages > 1 ? <div>
        <button
          aria-label="Página anterior"
          disabled={page <= 1}
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          <span aria-hidden="true">←</span><span className="ui-table__pagination-label">Anterior</span>
        </button>
        <span className="sr-only" aria-live="polite">Página {page} de {totalPages}</span>
        {visiblePages.map((number) => (
          <button
            aria-current={number === page ? "page" : undefined}
            aria-label={`Página ${number}`}
            key={number}
            type="button"
            onClick={() => onPageChange(number)}
          >
            {number}
          </button>
        ))}
        <button
          aria-label="Página siguiente"
          disabled={page >= totalPages}
          type="button"
          onClick={() => onPageChange(page + 1)}
        >
          <span className="ui-table__pagination-label">Siguiente</span><span aria-hidden="true">→</span>
        </button>
      </div> : null}
    </nav>
  );
}

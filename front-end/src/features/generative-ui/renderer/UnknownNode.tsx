interface UnknownNodeProps {
  nodeType?: string;
}

export function UnknownNode({ nodeType }: UnknownNodeProps) {
  void nodeType;
  return (
    <div className="ui-renderer-message ui-renderer-message--unknown" role="status">
      <p className="ui-renderer-message__title">Esta parte de la vista no está disponible</p>
      <p className="ui-renderer-message__details">Puedes seguir revisando el resto del resultado.</p>
    </div>
  );
}

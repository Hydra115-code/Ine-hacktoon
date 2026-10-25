"use client";

import { useState } from "react";
import type { InteractionNode } from "../../schemas/interaction-node";
import { useInteractionEvent } from "../events/UIEventProvider";
import { validateSelectionCount } from "../validation/interaction-validation";
import { FieldMessage } from "./FieldMessage";

type MultiSelectNode = Extract<InteractionNode, { type: "multiSelect" }>;

export function MultiSelect({ id, label, event, options, initialValue = [], minSelections, maxSelections, helpText, disabled }: MultiSelectNode) {
  const [value, setValue] = useState(initialValue);
  const emit = useInteractionEvent(id, event);
  const error = validateSelectionCount(value.length, minSelections, maxSelections);
  const messageId = `${id}-message`;

  return (
    <fieldset
      aria-describedby={helpText || error ? messageId : undefined}
      aria-invalid={Boolean(error)}
      className="ui-field ui-multi-select"
      disabled={disabled}
      id={id}
    >
      <legend>{label}</legend>
      <div className="ui-multi-select__options">
        {options.map((option) => {
          const checked = value.includes(option.value);
          const optionId = `${id}-${option.value}`;
          return (
            <label data-selected={checked || undefined} htmlFor={optionId} key={option.value}>
              <input
                checked={checked}
                disabled={option.disabled || (!checked && maxSelections !== undefined && value.length >= maxSelections)}
                id={optionId}
                type="checkbox"
                value={option.value}
                onChange={(changeEvent) => {
                  const nextValue = changeEvent.target.checked
                    ? [...value, option.value]
                    : value.filter((item) => item !== option.value);
                  const nextError = validateSelectionCount(nextValue.length, minSelections, maxSelections);
                  setValue(nextValue);
                  emit(nextValue, !nextError);
                }}
              />
              <span aria-hidden="true" className="ui-multi-select__mark">{checked ? "✓" : "+"}</span>
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      <p className="ui-multi-select__count">{value.length} {value.length === 1 ? "selección" : "selecciones"}{maxSelections ? ` de ${maxSelections}` : ""}</p>
      <FieldMessage error={error} helpText={helpText} id={messageId} />
    </fieldset>
  );
}

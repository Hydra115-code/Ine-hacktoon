import {
  uiPatchSchema,
  type UIPatch,
  type UISpecification,
  type UINode,
} from "@banorte/contracts";

export function createSharedUiPatch(
  current: UISpecification,
  next: UISpecification,
  baseRevision: number,
): UIPatch {
  const appendedChild = findSingleAppendedChild(current.root, next.root);
  const removedChild = findSingleRemovedChild(current.root, next.root);
  const replacedChild = findSingleReplacedChild(current.root, next.root);
  const propertyChanges = findPropertyChanges(current.root, next.root);
  return uiPatchSchema.parse(
    appendedChild
      ? {
      version: "1",
      baseRevision,
      revision: baseRevision + 1,
      op: "add",
      target: current.root.id,
      node: appendedChild,
    }
      : removedChild
        ? {
          version: "1",
          baseRevision,
          revision: baseRevision + 1,
          op: "remove",
          target: removedChild.id,
        }
        : replacedChild
          ? {
            version: "1",
            baseRevision,
            revision: baseRevision + 1,
            op: "replace",
            target: replacedChild.current.id,
            node: replacedChild.next,
          }
          : propertyChanges
            ? {
              version: "1",
              baseRevision,
              revision: baseRevision + 1,
              op: "update",
              target: current.root.id,
              changes: propertyChanges,
            }
            : {
      version: "1",
      baseRevision,
      revision: baseRevision + 1,
      op: "replace",
      target: current.root.id,
      node: next.root,
    },
  );
}

export function createSharedUiPatches(current: UISpecification, next: UISpecification, baseRevision: number): UIPatch[] {
  const patches: UIPatch[] = [];
  const emit = (patch: Record<string, unknown>) => patches.push(uiPatchSchema.parse({
    version: "1", baseRevision: baseRevision + patches.length,
    revision: baseRevision + patches.length + 1, ...patch,
  }));
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const diff = (before: UINode, after: UINode): void => {
    if (equal(before, after)) return;
    if (before.id === after.id && before.type === after.type
      && "children" in before && "children" in after) {
      const { children: oldChildren, ...oldProperties } = before;
      const { children: newChildren, ...newProperties } = after;
      const oldIds = oldChildren.map((child) => child.id);
      const newIds = newChildren.map((child) => child.id);
      const retainedOld = oldIds.filter((id) => newIds.includes(id));
      const retainedNew = newIds.filter((id) => oldIds.includes(id));
      const additions = newChildren.filter((child) => !oldIds.includes(child.id));
      const pureReorder = oldIds.length === newIds.length
        && oldIds.every(Boolean) && newIds.every(Boolean)
        && oldIds.every((id) => newIds.includes(id))
        && equal(oldProperties, newProperties)
        && oldChildren.every((child) => equal(child, newChildren.find((candidate) => candidate.id === child.id)));
      if (pureReorder) {
        const order = [...oldIds];
        for (let index = 0; index < newIds.length; index += 1) {
          const desired = newIds[index];
          if (order[index] === desired || !desired) continue;
          const previousIndex = order.indexOf(desired);
          order.splice(previousIndex, 1);
          order.splice(index, 0, desired);
          emit({ op: "move", target: desired, parent: before.id, index });
        }
        return;
      }
      // Contract add appends: never silently change the requested order.
      const appendOnly = equal([...retainedNew, ...additions.map((child) => child.id)], newIds);
      const removedProperties = Object.keys(oldProperties).some((key) => !(key in newProperties));
      if (!removedProperties && equal(retainedOld, retainedNew) && appendOnly
        && oldIds.every(Boolean) && newIds.every(Boolean)) {
        const changes = Object.fromEntries(Object.entries(newProperties).filter(([key, value]) => key !== "id" && key !== "type" && !equal(Reflect.get(oldProperties, key), value)));
        if (Object.keys(changes).length) emit({ op: "update", target: before.id, changes });
        for (const child of oldChildren) if (!newIds.includes(child.id)) emit({ op: "remove", target: child.id });
        for (const child of newChildren) {
          const existing = oldChildren.find((candidate) => candidate.id === child.id);
          if (existing) diff(existing, child);
          else emit({ op: "add", target: before.id, node: child });
        }
        return;
      }
    }
    const changes = findPropertyChanges(before, after);
    // Removed properties cannot be represented by update; replacement is safe.
    const hasRemovedProperty = Object.keys(before).some((key) => !(key in after));
    if (changes && !hasRemovedProperty) emit({ op: "update", target: before.id, changes });
    else emit({ op: "replace", target: before.id, node: after });
  };
  diff(current.root, next.root);
  return patches;
}

function findSingleAppendedChild(current: UINode, next: UINode): UINode | undefined {
  if (current.id !== next.id || current.type !== next.type) return undefined;
  if (!("children" in current) || !("children" in next)) return undefined;
  if (next.children.length !== current.children.length + 1) return undefined;

  const retainedChildren = next.children.slice(0, current.children.length);
  return JSON.stringify(current.children) === JSON.stringify(retainedChildren)
    ? next.children.at(-1)
    : undefined;
}

function findSingleRemovedChild(current: UINode, next: UINode): UINode | undefined {
  if (current.id !== next.id || current.type !== next.type) return undefined;
  if (!("children" in current) || !("children" in next)) return undefined;
  if (current.children.length !== next.children.length + 1) return undefined;
  const removed = current.children.filter((child) => !next.children.some((candidate) => candidate.id === child.id));
  if (removed.length !== 1) return undefined;
  const retained = current.children.filter((child) => child.id !== removed[0]?.id);
  return JSON.stringify(retained) === JSON.stringify(next.children) ? removed[0] : undefined;
}

function findSingleReplacedChild(
  current: UINode,
  next: UINode,
): { current: UINode; next: UINode } | undefined {
  if (current.id !== next.id || current.type !== next.type) return undefined;
  if (!("children" in current) || !("children" in next)) return undefined;
  if (current.children.length !== next.children.length) return undefined;
  if (current.children.some((child, index) => child.id !== next.children[index]?.id)) return undefined;
  const changed = current.children
    .map((child, index) => ({ current: child, next: next.children[index]! }))
    .filter((pair) => JSON.stringify(pair.current) !== JSON.stringify(pair.next));
  return changed.length === 1 ? changed[0] : undefined;
}

function findPropertyChanges(current: UINode, next: UINode): Record<string, unknown> | undefined {
  if (current.id !== next.id || current.type !== next.type || "children" in current || "children" in next) return undefined;
  const currentProperties = current as unknown as Record<string, unknown>;
  const nextProperties = next as unknown as Record<string, unknown>;
  const changes = Object.fromEntries(Object.entries(nextProperties).filter(([key, value]) => (
    key !== "id" && key !== "type" && JSON.stringify(currentProperties[key]) !== JSON.stringify(value)
  )));
  return Object.keys(changes).length > 0 ? changes : undefined;
}

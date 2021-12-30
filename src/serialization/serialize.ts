import { FACTORIES, mainNodeId, SKIP_AUTO_PROPS } from "./common";

/**
 * Serialize a node to a simple JSON object
 *
 * Current limitations:
 * - Styles aren't yet serialized, so end up flattened
 * - No support for mixed stroke caps
 * - Lots of bugs + performance issues with groups + boolean operations
 *   - e.g. group contents are out of order
 *
 * @param node The node to serialize
 * @param tryConcise EXPERIMENTAL. Tries to spit out a smaller object by only exporting
 *    properties that aren't their default values. This doesn't work well for nodes inside
 *    component instances.
 * @returns A simple JSON object representing the node
 */
export function serializeNode(node: SceneNode, tryConcise = false): SerializedNode {
  // Thanks to Jackie Chui for the original approach
  // https://spectrum.chat/figma/extensions-and-api/dump-hierarchy-to-json~6d28b71c-7fb6-4401-aa7d-1674769e4e2b
  const props = Object
    .entries<PropertyDescriptor>(Object.getOwnPropertyDescriptors(node['__proto__']))
    .filter(([name]) => !SKIP_AUTO_PROPS.has(name));

  const obj: any = {
    id: mainNodeId(node.id),
    type: node.type,
    width: node.width,
    height: node.height,
  };

  for (const [name, prop] of props) {
    if (!prop.get) {
      continue;
    }

    obj[name] = prop.get.call(node);
    if (typeof obj[name] === 'symbol') { // e.g. strokeCap :-/
      delete obj[name];
    }
  }

  if ('mainComponent' in node) {
    obj._componentKey = node.mainComponent?.key;
  }

  if ('getRangeFontName' in node) {
    let fonts = new Set<string>([JSON.stringify(node.fontName)]);
    let len = node.characters.length;
    for (let i = 0; i < len; i++) {
      fonts.add(JSON.stringify(node.getRangeFontName(i, i + 1)));
    }
    obj._fonts = [...fonts].map(f => JSON.parse(f));
  }

  if (tryConcise) {
    // remove all values that are the same as the default
    if (FACTORIES[node.type]) {
      let emptyNode = FACTORIES[node.type]!();

      for (const [name, prop] of props) {
        if (name === 'id' || name === 'type') {
          continue;
        }
        if (prop.get && JSON.stringify(obj[name]) === JSON.stringify(prop.get.call(emptyNode))) {
          delete obj[name];
        }
      }

      emptyNode.remove();
    }
  }

  if ('children' in node) {
    obj.children = node.children.map(n => serializeNode(n, tryConcise));
  }

  return obj;
}

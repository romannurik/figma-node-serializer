import {
  BOOLEAN_OP_FACTORIES,
  FACTORIES,
  mainNodeId,
  SKIP_AUTO_PROPS,
  SKIP_GROUP_PROPS,
  SKIP_IN_INSTANCE_PROPS
} from "./common";

/**
 * Create a real Figma node from an object produced by `serializeNode`.
 *
 * @param obj A previously serialized node, i.e. something that `serializeNode` returned.
 * @returns A new node, or null if nothing could be deserialized.
 */
export async function deserializeNode(obj: SerializedNode): Promise<SceneNode | null> {
  // Load all referenced fonts and import all referenced components in parallel
  await Promise.all([
    ...[...gatherFonts(obj)]
      .map(f => JSON.parse(f))
      .map(font => figma.loadFontAsync(font)),
    ...[...gatherComponentKeys(obj)]
      .map(key => figma.importComponentByKeyAsync(key).catch(() => { })),
  ]);

  // Actually deserialize
  return await deserializeInner(obj);
}

/**
 * Gather all fonts referenced in the given serialized object
 */
function gatherFonts(obj: SerializedNode): Set<string> {
  let fonts = new Set<string>();

  if ('_fonts' in obj) {
    for (let f of obj._fonts.map(f => JSON.stringify(f))) {
      fonts.add(f);
    }
  }

  if ('children' in obj) {
    for (const child of obj.children) {
      for (let f of gatherFonts(child)) {
        fonts.add(f);
      }
    }
  }

  return new Set(fonts);
}

/**
 * Gather all component keys referenced in the serialized object.
 */
function gatherComponentKeys(obj: SerializedNode): Set<string> {
  let keys = new Set<string>();

  if ('_componentKey' in obj) {
    keys.add(obj._componentKey);
  }

  if ('children' in obj) {
    for (const child of obj.children) {
      for (let f of gatherComponentKeys(child)) {
        keys.add(f);
      }
    }
  }

  return keys;
}

// inner deserialization function, called recursively
async function deserializeInner(
  obj: SerializedNode,
  parent?: SceneNode
): Promise<SceneNode | null> {
  const { type } = obj;
  const factory = FACTORIES[type];

  if (factory) {
    // most common node types
    const node: SceneNode = factory();
    setProperties(node, obj);
    if ('children' in node) {
      for (let c of await deserializeChildren(obj)) {
        node.appendChild(c);
      }
    }
    return node;

  } else if (type === 'GROUP' || type === 'BOOLEAN_OPERATION') {
    // special handling for groups + booleans, which is currently very clumsy, inaccurate, and
    // slow
    const factory = (type === 'BOOLEAN_OPERATION')
      ? BOOLEAN_OP_FACTORIES[obj.booleanOperation]
      : figma.group;

    // the following approach produces more accurate results but 10x slower for some reason... here,
    // we start the group off with a throwaway node, and then append its actual children one by one,
    // and later remove the throwaway node.

    // let r = figma.createRectangle();
    // const node: GroupNode = factory([r], figma.currentPage);
    // for (let c of deserializedChildren) {
    //   node.appendChild(c);
    // }
    // r.remove();

    const node: GroupNode = factory(await deserializeChildren(obj), figma.currentPage);
    setProperties(node, obj);
    return node;

  } else if (type === 'INSTANCE') {
    // deserialize an instance node
    let mainComponent: ComponentNode;
    try {
      mainComponent = await figma.importComponentByKeyAsync(obj._componentKey);
    } catch (e) {
      console.warn(`Couldn't instantiate an instance of ${obj._componentKey}`);
      return null;
    }

    const node: InstanceNode = mainComponent.createInstance();
    deserializeInstanceOverrides(obj, node, false);
    return node;

  } else {
    console.warn(`Couldn't instantiate a node of type ${type}`);
    return null;
  }
}

/**
 * Deserializes the given object's children in parallel
 */
async function deserializeChildren(obj: SerializedNode) {
  return (await Promise.all((obj.children || []).map(c => deserializeInner(c)))).filter(n => !!n);
}

/**
 * Deserializes overrides on a component instance, recursively.
 *
 * @param obj The serialized node
 * @param overrideNode The node (at the top-level, a component instances)
 * @param isRoot Whether or not `overrideNode` is the root instance, or if this is a node somewhere
 *     deeper in the instance's hierarchy.
 */
async function deserializeInstanceOverrides(
  obj: SerializedNode,
  overrideNode: SceneNode,
  isRoot: boolean = false
): Promise<void> {
  setProperties(overrideNode, obj, isRoot);
  if ('children' in overrideNode) {
    for (const child of obj.children || []) {
      let childNode = overrideNode.findChild(n => mainNodeId(n.id) === child.id);
      if (childNode) {
        await deserializeInstanceOverrides(child, childNode, true);
      }
    }
  }
}

/**
 * Sets the actual properties on the given node from the given serialized object, e.g.
 * text, fill colors, etc.
 */
function setProperties(node: SceneNode, obj: SerializedNode, isInInstance = false) {
  let props = Object
    .entries<PropertyDescriptor>(Object.getOwnPropertyDescriptors(node['__proto__']))
    .filter(([name]) => !SKIP_AUTO_PROPS.has(name))
    .sort(sortPropsForSet);
  if (isInInstance) {
    props = props.filter(([name]) => !SKIP_IN_INSTANCE_PROPS.has(name));
  }
  if (obj.type === 'GROUP' || obj.type === 'BOOLEAN_OPERATION') {
    props = props.filter(([name]) => !SKIP_GROUP_PROPS.has(name));
  }
  for (const [name, prop] of props) {
    if (name in obj && prop.set) {
      // special case to avoid warnings around layoutAlign=CENTER being deprecated
      if (name === 'layoutAlign' && obj[name] === 'CENTER') {
        continue;
      }

      // set the property on the node
      prop.set.call(node, obj[name]);
    }
  }

  if ('resizeWithoutConstraints' in node && obj.width && obj.height) {
    node.resizeWithoutConstraints(obj.width, obj.height);
  }
}

const PRIORITIZE_PROPERTIES = new Set([
  'fontName' // set font before anything else to avoid layout issues
]);

/**
 * Property sort comparison method for {@link setProperties} that ensures certain properties
 * are set before others.
 */
function sortPropsForSet(a: [string, PropertyDescriptor], b: [string, PropertyDescriptor]): number {
  if (PRIORITIZE_PROPERTIES.has(a[0])) return -1;
  if (PRIORITIZE_PROPERTIES.has(b[0])) return 1;
  return a[0].localeCompare(b[0]);
}

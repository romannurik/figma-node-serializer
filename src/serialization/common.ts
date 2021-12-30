/**
 * Properties to skip automatic serialization and deserialization of. Some of these
 * get handled manually, some don't get serialized at all (e.g. parent).
 */
export const SKIP_AUTO_PROPS = new Set([
  'type', 'parent', 'children', 'removed', '_fonts',
  'autoRename', 'overflowDirection', 'width', 'height',
  'absoluteTransform',
  'vectorPaths', // covered by vectorNetwork
  'x', 'y', 'rotation', 'scaleFactor', // covered by 'relativeTransform'
  'mainComponent', 'masterComponent',
  'backgrounds', 'backgroundStyleId',
  'horizontalPadding', 'verticalPadding',
  'fillGeometry', 'strokeGeometry',
]);

/**
 * Properties to skip deserializing for groups an boolean ops.
 */
export const SKIP_GROUP_PROPS = new Set([
  'relativeTransform', 'x', 'y', 'rotation', 'scaleFactor',
]);

/**
 * Properties to skip deserializing for nodes inside a component instance
 */
export const SKIP_IN_INSTANCE_PROPS = new Set([
  'relativeTransform', 'x', 'y', 'rotation', 'scaleFactor',
  'constraints', 'vectorNetwork',
  'constrainProportions', 'isMask', 'numberOfFixedChildren',
  'booleanOperation',
]);

export const FACTORIES: { [type in SceneNode['type']]?: () => SceneNode } = {
  RECTANGLE: figma.createRectangle,
  LINE: figma.createLine,
  ELLIPSE: figma.createEllipse,
  POLYGON: figma.createPolygon,
  STAR: figma.createStar,
  VECTOR: figma.createVector,
  TEXT: figma.createText,
  FRAME: figma.createFrame,
  COMPONENT: figma.createComponent,
  SLICE: figma.createSlice,
};

type BooleanOpFactory = typeof figma.exclude;
type BooleanOpType = BooleanOperationNode['booleanOperation'];

export const BOOLEAN_OP_FACTORIES: { [type in BooleanOpType]?: BooleanOpFactory } = {
  UNION: figma.union,
  EXCLUDE: figma.exclude,
  INTERSECT: figma.intersect,
  SUBTRACT: figma.subtract,
};

/**
 * Parses out the main Node ID from a node ID. For nodes outside a component,
 * this is just the node ID. For nodes inside a component, this turns IDs like:
 *
 *     I4:1229;0:5435
 *
 * into:
 *
 *     0:5435
 */
export function mainNodeId(id: string): string {
  return id.replace(/^.*\;/, '');
}

export const skipChildren = Symbol('skipChildren');

export function walk(node: BaseNode, fn: (node: BaseNode, context: any) => any, context?: any) {
  context = fn(node, context);
  if (context === skipChildren) {
    return;
  }
	if ('children' in node && node.children) {
    for (let child of node.children) {
      walk(child, fn, context);
    }
	}
}

export async function asyncWalk(node: BaseNode, fn: (node: BaseNode, context: any) => Promise<any>, context?: any) {
  context = await fn(node, context);
  if (context === skipChildren) {
    return;
  }
	if ('children' in node && node.children) {
		for (let child of node.children) {
      await asyncWalk(child, fn, context);
    }
	}
}


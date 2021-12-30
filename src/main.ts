import { deserializeNode, serializeNode } from "./serialization";

export default async function () {
  try {
    if (!figma.currentPage.selection.length) {
      figma.closePlugin("Select something first!");
      return;
    }

    let node = figma.currentPage.selection[0];

    // Serialize node to a simple JSON object
    let d = Date.now();
    let serialized = serializeNode(node, true);
    let serializeTime = Date.now() - d;

    // Deserialize back into a node
    d = Date.now();
    let newNode = await deserializeNode(serialized);
    let deserializeTime = Date.now() - d;
    if (!newNode) {
      throw new Error(`Couldn't deserialize`);
    }

    // console.log(JSON.stringify(serialized, null, 2));
    // console.log(newNode);

    // Add the deserialized node next to the original node
    node.parent!.appendChild(newNode);
    newNode.x = node.x + node.width * 1.2
    figma.currentPage.selection = [newNode];

    // Report on stats
    figma.notify([
      `Size: ${(JSON.stringify(serialized).length / 1000).toFixed(0)} KB`,
      `Ser: ${(serializeTime / 1000).toFixed(2)} sec`,
      `De: ${(deserializeTime / 1000).toFixed(2)} sec`
    ].join(' --- '));
    figma.closePlugin();
  } catch (e) {
    figma.notify('Error: ' + String(e), { error: true });
    figma.closePlugin();
    throw e;
  }
}

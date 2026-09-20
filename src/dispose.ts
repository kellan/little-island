import * as THREE from 'three';
// Three releases an InstancedMesh's per-instance matrix buffer only from its own
// dispose(); disposing geometry and material leaves that buffer allocated in the
// driver. Rebuilding a 50,000-tree forest strands 3 MB per mesh without it.
export function disposeObject(root: THREE.Object3D, options: { keepMaterials?: boolean } = {}): void {
  const seen = new Set<THREE.Material>();
  root.traverse(object => {
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return;
    object.geometry.dispose();
    if (options.keepMaterials) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (!seen.has(material)) { seen.add(material); material.dispose(); }
  });
  root.removeFromParent();
  root.clear();
}

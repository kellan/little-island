import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { disposeObject } from './dispose.ts';

type DisposeSource = { addEventListener(type: 'dispose', listener: () => void): void };
const counter = (target: DisposeSource) => {
  const seen = { count: 0 };
  target.addEventListener('dispose', () => seen.count++);
  return seen;
};

describe('disposeObject', () => {
  it('releases the per-instance matrix buffer of an InstancedMesh', () => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 16);
    const group = new THREE.Group(); group.add(mesh);
    // WebGLObjects frees the instance buffer from the mesh's own dispose event.
    const instances = counter(mesh), geometry = counter(mesh.geometry), material = counter(mesh.material);
    disposeObject(group);
    expect(instances.count).toBe(1);
    expect(geometry.count).toBe(1);
    expect(material.count).toBe(1);
  });
  it('reaches meshes nested below the root', () => {
    const group = new THREE.Group(), branch = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    branch.add(mesh); group.add(branch);
    const geometry = counter(mesh.geometry);
    disposeObject(group);
    expect(geometry.count).toBe(1);
    expect(group.children.length).toBe(0);
  });
  it('disposes every material of a multi-material mesh', () => {
    const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    const counts = materials.map(counter);
    disposeObject(mesh);
    expect(counts.map(c => c.count)).toEqual([1, 1]);
  });
  it('disposes a shared material only once', () => {
    const shared = new THREE.MeshBasicMaterial(), group = new THREE.Group();
    for (let i = 0; i < 5; i++) group.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));
    const material = counter(shared);
    disposeObject(group);
    expect(material.count).toBe(1);
  });
  it('can keep materials that outlive the object', () => {
    const shared = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const geometry = counter(mesh.geometry), material = counter(shared);
    disposeObject(mesh, { keepMaterials: true });
    expect(geometry.count).toBe(1);
    expect(material.count).toBe(0);
  });
  it('ignores objects that own no GPU resources', () => {
    const group = new THREE.Group();
    group.add(new THREE.Object3D(), new THREE.Group());
    expect(() => disposeObject(group)).not.toThrow();
  });
});

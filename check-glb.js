import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';

async function main() {
  const io = new NodeIO();
  // download the glb first
  const fetch = await import('node-fetch');
  const res = await fetch.default('https://raw.githubusercontent.com/vetrina72-byte/assets/main/volvo_ex30.glb');
  const buffer = await res.arrayBuffer();
  const document = await io.readBinary(new Uint8Array(buffer));
  
  let vertexCount = 0;
  let triangleCount = 0;
  let materialCount = document.getRoot().listMaterials().length;
  let textureCount = document.getRoot().listTextures().length;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (position) {
        vertexCount += position.getCount();
      }
      const indices = prim.getIndices();
      if (indices) {
        triangleCount += indices.getCount() / 3;
      } else if (position) {
        triangleCount += position.getCount() / 3;
      }
    }
  }

  console.log(`GLB Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Vertices: ${vertexCount}`);
  console.log(`Triangles: ${triangleCount}`);
  console.log(`Materials: ${materialCount}`);
  console.log(`Textures: ${textureCount}`);
  
  let texSize = 0;
  for (const tex of document.getRoot().listTextures()) {
    if (tex.getImage()) texSize += tex.getImage().length;
  }
  console.log(`Total Texture Size: ${(texSize / 1024 / 1024).toFixed(2)} MB`);
}
main();

import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as THREE from "three";
import { createColoredCube } from "./cube";

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYTE4NjhhMy01YjM0LTQ0MDYtOThjMi1hNWJlYmI5MWY3YzQiLCJpZCI6MzQ2NzMzLCJpYXQiOjE3NTk0NTA4NDN9.IQ-97lJJ-qTrkTUllzEMiMAIgCVSEb9eQxwIbSJ_zjo";

const location = {
  lat: 35.687755,
  lng: 139.776646,
  height: 200,
};

const position = Cesium.Cartesian3.fromDegrees(
  location.lng,
  location.lat,
  location.height
);

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(2767062),
  baseLayerPicker: false,
  sceneModePicker: false,
  animation: false,
  timeline: false,
  shadows: true,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;

try {
  // Load the Japan Building data asset
  const tileset = await Cesium.Cesium3DTileset.fromUrl(
    "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json"
  );
  scene.primitives.add(tileset);
  await viewer.zoomTo(tileset);
} catch (error) {
  console.log(error);
}

// Set up a light to come from the camera to always highlight the buildings
const cameraLight = new Cesium.DirectionalLight({
  direction: scene.camera.directionWC, // Updated every frame
  intensity: 2.0,
});
scene.globe.enableLighting = true;
scene.globe.dynamicAtmosphereLightingFromSun = false;
scene.globe.dynamicAtmosphereLighting = false;
scene.light = cameraLight;

scene.preRender.addEventListener(function (scene, time) {
  scene.light.direction = Cesium.Cartesian3.clone(
    scene.camera.directionWC,
    scene.light.direction
  );
});

// Three.js
const threeContainer = document.getElementById("three");
const threeScene = new THREE.Scene();
const threeCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1,
  50000000
);
const threeRenderer = new THREE.WebGLRenderer({ alpha: true });
threeRenderer.setSize(window.innerWidth, window.innerHeight);
threeContainer?.appendChild(threeRenderer.domElement);

// Create a cube in Three.js and add it to the scene
const cube = createColoredCube();
cube.position.set(position.x, position.y, position.z);
threeScene.add(cube);

// Direct the Cesium camera to look at the cube
viewer.camera.lookAt(position, new Cesium.Cartesian3(100.0, 500.0, 300.0));
viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

function updateThreeJS() {
  // Update Three.js camera field of view to match Cesium camera's vertical FOV
  threeCamera.fov = Cesium.Math.toDegrees(viewer.camera.frustum.fovy);
  threeCamera.updateProjectionMatrix();

  // Sync Three.js camera with Cesium camera
  const cesiumCamera = viewer.camera;
  const cvm = cesiumCamera.viewMatrix;
  const civm = cesiumCamera.inverseViewMatrix;

  // Fix the extraction of camera position and direction from matrices
  const cameraPosition = Cesium.Cartesian3.fromElements(
    civm[12],
    civm[13],
    civm[14]
  );
  const cameraDirection = new Cesium.Cartesian3(-cvm[2], -cvm[6], -cvm[10]);
  const cameraUp = new Cesium.Cartesian3(cvm[1], cvm[5], cvm[9]);

  const cameraPositionVec3 = new THREE.Vector3(
    cameraPosition.x,
    cameraPosition.y,
    cameraPosition.z
  );
  const cameraDirectionVec3 = new THREE.Vector3(
    cameraDirection.x,
    cameraDirection.y,
    cameraDirection.z
  );
  const cameraUpVec3 = new THREE.Vector3(cameraUp.x, cameraUp.y, cameraUp.z);

  // Update Three.js camera position and orientation
  threeCamera.position.copy(cameraPositionVec3);
  threeCamera.up.copy(cameraUpVec3);
  threeCamera.lookAt(cameraPositionVec3.clone().add(cameraDirectionVec3));

  // Apply rotation to the cube
  cube.rotation.x += 0.01;
  // Render the scene with the updated camera
  threeRenderer.render(threeScene, threeCamera);
}

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  threeRenderer.setSize(width, height);
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
});

function renderLoop() {
  requestAnimationFrame(renderLoop);
  viewer.render();
  updateThreeJS();
}

renderLoop();

// scene.camera.flyTo({
//   destination: Cesium.Cartesian3.fromDegrees(
//     location.lng,
//     location.lat,
//     location.height
//   ),
//   orientation: {
//     heading: Cesium.Math.toRadians(200),
//     pitch: Cesium.Math.toRadians(-7),
//   },
// });

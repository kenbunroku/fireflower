import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

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

const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(location.lng, location.lat)
);

const emitterInitialLocation = new Cesium.Cartesian3(
  location.lng,
  location.lat,
  location.height
);

let particleCanvas;

function getImage() {
  if (!Cesium.defined(particleCanvas)) {
    particleCanvas = document.createElement("canvas");
    particleCanvas.width = 20;
    particleCanvas.height = 20;
    const context2D = particleCanvas.getContext("2d");
    context2D.beginPath();
    context2D.arc(8, 8, 8, 0, Cesium.Math.TWO_PI, true);
    context2D.closePath();
    context2D.fillStyle = "rgb(255, 255, 255)";
    context2D.fill();
  }
  return particleCanvas;
}

const minimumExplosionSize = 30.0;
const maximumExplosionSize = 100.0;
const particlePixelSize = new Cesium.Cartesian2(7.0, 7.0);
const burstSize = 400.0;
const lifetime = 10.0;
const numberOfFireworks = 20.0;

const emitterModelMatrixScratch = new Cesium.Matrix4();

function createFirework(offset, color, bursts) {
  const position = Cesium.Cartesian3.add(
    emitterInitialLocation,
    offset,
    new Cesium.Cartesian3()
  );
  const emitterModelMatrix = Cesium.Matrix4.fromTranslation(
    position,
    emitterModelMatrixScratch
  );
  const particleToWorld = Cesium.Matrix4.multiply(
    modelMatrix,
    emitterModelMatrix,
    new Cesium.Matrix4()
  );
  const worldToParticle = Cesium.Matrix4.inverseTransformation(
    particleToWorld,
    particleToWorld
  );

  const size = Cesium.Math.randomBetween(
    minimumExplosionSize,
    maximumExplosionSize
  );
  const particlePositionScratch = new Cesium.Cartesian3();
  const force = function (particle) {
    const position = Cesium.Matrix4.multiplyByPoint(
      worldToParticle,
      particle.position,
      particlePositionScratch
    );
    if (Cesium.Cartesian3.magnitudeSquared(position) >= size * size) {
      Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, particle.velocity);
    }
  };

  const normalSize =
    (size - minimumExplosionSize) /
    (maximumExplosionSize - minimumExplosionSize);
  const minLife = 0.3;
  const maxLife = 1.0;
  const life = normalSize * (maxLife - minLife) + minLife;

  scene.primitives.add(
    new Cesium.ParticleSystem({
      image: getImage(),
      startColor: color,
      endColor: color.withAlpha(0.0),
      particleLife: life,
      speed: 100.0,
      imageSize: particlePixelSize,
      emissionRate: 0,
      emitter: new Cesium.SphereEmitter(0.1),
      bursts: bursts,
      lifetime: lifetime,
      updateCallback: force,
      modelMatrix: modelMatrix,
      emitterModelMatrix: emitterModelMatrix,
    })
  );
}

const xMin = -100.0;
const xMax = 100.0;
const yMin = -80.0;
const yMax = 100.0;
const zMin = -50.0;
const zMax = 50.0;

const colorOptions = [
  {
    minimumRed: 0.75,
    green: 0.0,
    minimumBlue: 0.8,
    alpha: 1.0,
  },
  {
    red: 0.0,
    minimumGreen: 0.75,
    minimumBlue: 0.8,
    alpha: 1.0,
  },
  {
    red: 0.0,
    green: 0.0,
    minimumBlue: 0.8,
    alpha: 1.0,
  },
  {
    minimumRed: 0.75,
    minimumGreen: 0.75,
    blue: 0.0,
    alpha: 1.0,
  },
];

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(2767062),
  baseLayerPicker: false,
  sceneModePicker: false,
  animation: false,
  timeline: false,
  shadows: true,
  shouldAnimate: true,
});
const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.debugShowFramesPerSecond = true;

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

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  threeRenderer.setSize(width, height);
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
});

for (let i = 0; i < numberOfFireworks; ++i) {
  const x = Cesium.Math.randomBetween(xMin, xMax);
  const y = Cesium.Math.randomBetween(yMin, yMax);
  const z = Cesium.Math.randomBetween(zMin, zMax);
  const offset = new Cesium.Cartesian3(x, y, z);
  const color = Cesium.Color.fromRandom(colorOptions[i % colorOptions.length]);

  const bursts = [];
  for (let j = 0; j < 3; ++j) {
    bursts.push(
      new Cesium.ParticleBurst({
        time: Cesium.Math.nextRandomNumber() * lifetime,
        minimum: burstSize,
        maximum: burstSize,
      })
    );
  }

  createFirework(offset, color, bursts);
}

const camera = viewer.scene.camera;
const cameraOffset = new Cesium.Cartesian3(-300.0, 0.0, 0.0);
camera.lookAtTransform(modelMatrix, cameraOffset);
camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

const toFireworks = Cesium.Cartesian3.subtract(
  emitterInitialLocation,
  cameraOffset,
  new Cesium.Cartesian3()
);
Cesium.Cartesian3.normalize(toFireworks, toFireworks);
const angle =
  Cesium.Math.PI_OVER_TWO -
  Math.acos(Cesium.Cartesian3.dot(toFireworks, Cesium.Cartesian3.UNIT_Z));
camera.lookUp(angle);

scene.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(
    location.lng,
    location.lat,
    location.height
  ),
  orientation: {
    heading: Cesium.Math.toRadians(200),
    pitch: Cesium.Math.toRadians(-7),
  },
});

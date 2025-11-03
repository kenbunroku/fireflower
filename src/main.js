import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYTE4NjhhMy01YjM0LTQ0MDYtOThjMi1hNWJlYmI5MWY3YzQiLCJpZCI6MzQ2NzMzLCJpYXQiOjE3NTk0NTA4NDN9.IQ-97lJJ-qTrkTUllzEMiMAIgCVSEb9eQxwIbSJ_zjo";

const location = {
  lat: 35.716833,
  lng: 139.805278,
  height: 200,
};

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
const particlePixelSize = new Cesium.Cartesian2(5.0, 5.0);
const burstSize = 400.0;
const lifetime = 10.0;
const numberOfFireworks = 1.0;

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

  // ---------------------- 追加で使うスクラッチ ----------------------
  const upScratch = new Cesium.Cartesian3();
  const gravityDirScratch = new Cesium.Cartesian3();

  // チューニング用パラメータ
  const GRAVITY = 9.8; // m/s^2（小さくすると「ゆっくり落下」の演出）

  const particlePositionScratch = new Cesium.Cartesian3();
  const force = function (particle, dt) {
    const position = Cesium.Matrix4.multiplyByPoint(
      worldToParticle,
      particle.position,
      particlePositionScratch
    );
    if (Cesium.Cartesian3.magnitudeSquared(position) >= size * size) {
      Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, particle.velocity);
    }

    // 2) 重力（地球の曲率を考慮：ジオデティックの“下向き”に加速）
    //    上向き = geodeticSurfaceNormal(particle.position)
    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(particle.position, upScratch);
    Cesium.Cartesian3.negate(upScratch, gravityDirScratch); // 下向き
    Cesium.Cartesian3.multiplyByScalar(
      gravityDirScratch,
      GRAVITY * dt,
      gravityDirScratch
    );
    Cesium.Cartesian3.add(
      particle.velocity,
      gravityDirScratch,
      particle.velocity
    );
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
  shadows: false,
  shouldAnimate: true,
  infoBox: false,
  selectionIndicator: false,
  homeButton: false,
  navigationHelpButton: false,
});

const scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.debugShowFramesPerSecond = true;
scene.highDynamicRange = true;
const bloom = scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.glowOnly = false;
bloom.uniforms.contrast = 128.0; // 強めのコントラスト
bloom.uniforms.brightness = -0.4; // しきい値を下げる
bloom.uniforms.delta = 0.9;
bloom.uniforms.sigma = 4.0;
bloom.uniforms.stepSize = 1.0;

const initialJapanView = {
  destination: Cesium.Cartesian3.fromDegrees(138.0, 37.0, 4500000.0),
  orientation: {
    heading: 0.0,
    pitch: -Cesium.Math.PI_OVER_TWO,
    roll: 0.0,
  },
};
viewer.camera.setView(initialJapanView);

// === 夜の雰囲気設定 ===
viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(
  "2025-10-24T12:00:00Z"
);

try {
  // 台東区のLOD2のビルデータを読み込む
  const taito = await Cesium.Cesium3DTileset.fromUrl(
    "https://assets.cms.plateau.reearth.io/assets/59/0fbb20-59cb-4ce5-9d12-2273ce72e6d2/13106_taito-ku_city_2024_citygml_1_op_bldg_3dtiles_13106_taito-ku_lod2_no_texture/tileset.json"
  );
  taito.style = new Cesium.Cesium3DTileStyle({
    color: "mix(color('#666A6D'), color(), 0.2)",
  });

  // 墨田区のLOD2のビルデータを読み込む
  const sumida = await Cesium.Cesium3DTileset.fromUrl(
    "https://assets.cms.plateau.reearth.io/assets/5d/526931-ac09-44b4-a910-d2331d69c87a/13107_sumida-ku_city_2024_citygml_1_op_bldg_3dtiles_13107_sumida-ku_lod3_no_texture/tileset.json"
  );
  sumida.style = new Cesium.Cesium3DTileStyle({
    color: "mix(color('#666A6D'), color(), 0.2)",
  });

  scene.primitives.add(taito);
  scene.primitives.add(sumida);
} catch (error) {
  console.log(error);
}

const highlightState = {
  feature: undefined,
  originalColor: new Cesium.Color(),
};
const highlightColor = Cesium.Color.fromCssColorString("#f5e642");
const screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
const resetCameraButton = document.getElementById("resetCameraButton");
const startButton = document.getElementById("startExperienceButton");

function setResetCameraButtonVisible(isVisible) {
  if (!resetCameraButton) {
    return;
  }
  resetCameraButton.style.display = isVisible ? "block" : "none";
}

setResetCameraButtonVisible(false);
const roofViewOffsetMeters = 20.0;
const roofCartographicScratch = new Cesium.Cartographic();
const roofPositionScratch = new Cesium.Cartesian3();
const cameraDirectionScratch = new Cesium.Cartesian3();
const surfaceNormalScratch = new Cesium.Cartesian3();
const cameraRightScratch = new Cesium.Cartesian3();
const cameraUpScratch = new Cesium.Cartesian3();

function clearHighlightedBuilding() {
  if (!highlightState.feature) {
    return;
  }
  highlightState.feature.color = Cesium.Color.clone(
    highlightState.originalColor,
    new Cesium.Color()
  );
  highlightState.feature = undefined;
}

screenSpaceHandler.setInputAction((movement) => {
  if (!movement.endPosition) {
    return;
  }

  const pickedFeature = scene.pick(movement.endPosition);

  if (highlightState.feature && highlightState.feature !== pickedFeature) {
    clearHighlightedBuilding();
  }

  if (
    !pickedFeature ||
    !(pickedFeature instanceof Cesium.Cesium3DTileFeature)
  ) {
    return;
  }

  if (highlightState.feature === pickedFeature) {
    return;
  }

  highlightState.feature = pickedFeature;
  Cesium.Color.clone(pickedFeature.color, highlightState.originalColor);
  pickedFeature.color = highlightColor;
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

function flyCameraToBuildingRoof(screenPosition) {
  if (!scene.pickPositionSupported) {
    return;
  }

  const pickedPosition = scene.pickPosition(screenPosition);
  if (!Cesium.defined(pickedPosition)) {
    return;
  }

  Cesium.Cartographic.fromCartesian(
    pickedPosition,
    Cesium.Ellipsoid.WGS84,
    roofCartographicScratch
  );
  roofCartographicScratch.height += roofViewOffsetMeters;
  Cesium.Cartesian3.fromRadians(
    roofCartographicScratch.longitude,
    roofCartographicScratch.latitude,
    roofCartographicScratch.height,
    Cesium.Ellipsoid.WGS84,
    roofPositionScratch
  );

  Cesium.Cartesian3.subtract(
    fireworksFocus,
    roofPositionScratch,
    cameraDirectionScratch
  );
  Cesium.Cartesian3.normalize(cameraDirectionScratch, cameraDirectionScratch);

  Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    roofPositionScratch,
    surfaceNormalScratch
  );
  Cesium.Cartesian3.cross(
    cameraDirectionScratch,
    surfaceNormalScratch,
    cameraRightScratch
  );

  if (Cesium.Cartesian3.magnitudeSquared(cameraRightScratch) === 0.0) {
    Cesium.Cartesian3.clone(scene.camera.right, cameraRightScratch);
  } else {
    Cesium.Cartesian3.normalize(cameraRightScratch, cameraRightScratch);
  }

  Cesium.Cartesian3.cross(
    cameraRightScratch,
    cameraDirectionScratch,
    cameraUpScratch
  );
  Cesium.Cartesian3.normalize(cameraUpScratch, cameraUpScratch);

  const destination = Cesium.Cartesian3.clone(
    roofPositionScratch,
    new Cesium.Cartesian3()
  );
  const direction = Cesium.Cartesian3.clone(
    cameraDirectionScratch,
    new Cesium.Cartesian3()
  );
  const up = Cesium.Cartesian3.clone(cameraUpScratch, new Cesium.Cartesian3());
  const fireworksOffset = Cesium.Matrix4.multiplyByPoint(
    fireworksEnuInverse,
    destination,
    new Cesium.Cartesian3()
  );

  viewer.camera.flyTo({
    destination,
    orientation: {
      direction,
      up,
    },
    duration: 2.0,
    complete: () => {
      viewer.camera.lookAt(fireworksFocus, fireworksOffset);
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      setResetCameraButtonVisible(true);
    },
  });
}

screenSpaceHandler.setInputAction((click) => {
  const pickedFeature = scene.pick(click.position);

  if (
    !pickedFeature ||
    !(pickedFeature instanceof Cesium.Cesium3DTileFeature)
  ) {
    return;
  }

  flyCameraToBuildingRoof(click.position);
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Set up a light to come from the camera to always highlight the buildings
const cameraLight = new Cesium.DirectionalLight({
  direction: scene.camera.directionWC, // Updated every frame
  intensity: 2.0,
});

scene.globe.enableLighting = true;
// scene.globe.dynamicAtmosphereLightingFromSun = false;
// scene.globe.dynamicAtmosphereLighting = false;
// scene.light = cameraLight;

// scene.preRender.addEventListener(function (scene, time) {
//   scene.light.direction = Cesium.Cartesian3.clone(
//     scene.camera.directionWC,
//     scene.light.direction
//   );
// });

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

const initialViewHeading = Cesium.Math.toRadians(200);
const initialViewPitch = Cesium.Math.toRadians(-20);
const initialViewRange = 2000.0;
const fireworksFocus = Cesium.Cartesian3.fromDegrees(
  location.lng,
  location.lat,
  location.height
);
const fireworksEnuInverse = Cesium.Matrix4.inverseTransformation(
  Cesium.Transforms.eastNorthUpToFixedFrame(
    fireworksFocus,
    Cesium.Ellipsoid.WGS84,
    new Cesium.Matrix4()
  ),
  new Cesium.Matrix4()
);

function flyToDefaultFireworksView(duration = 2.0) {
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(fireworksFocus, 1.0),
    {
      offset: new Cesium.HeadingPitchRange(
        initialViewHeading,
        initialViewPitch,
        initialViewRange
      ),
      duration,
      complete: () => {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        setResetCameraButtonVisible(false);
      },
    }
  );
}

if (startButton) {
  startButton.addEventListener("click", () => {
    startButton.style.display = "none";
    setResetCameraButtonVisible(false);
    flyToDefaultFireworksView();
  });
}

if (resetCameraButton) {
  resetCameraButton.addEventListener("click", () => {
    viewer.camera.cancelFlight();
    clearHighlightedBuilding();
    setResetCameraButtonVisible(false);
    flyToDefaultFireworksView();
  });
}

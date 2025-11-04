import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as THREE from "three";
import { Pane } from "tweakpane";

const pane = new Pane();

const params = {
  fireworkColor: "#ffd700",
};
let viewer, scene;
let bloom;

const location = {
  lat: 35.716833,
  lng: 139.805278,
  height: 200,
};
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(location.lng, location.lat)
);

const fireworkColorPresets = {
  gold: "#ffd700",
  magenta: "#ff4dff",
  cyan: "#4dd2ff",
  white: "#ffffff",
};
const defaultFireworkColorKey = "gold";

const setup = () => {
  setupPlateauAssets();
};

const setupPlateauAssets = async () => {
  setupBloom();
};

const setupBloom = () => {};

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYTE4NjhhMy01YjM0LTQ0MDYtOThjMi1hNWJlYmI5MWY3YzQiLCJpZCI6MzQ2NzMzLCJpYXQiOjE3NTk0NTA4NDN9.IQ-97lJJ-qTrkTUllzEMiMAIgCVSEb9eQxwIbSJ_zjo";

viewer = new Cesium.Viewer("cesiumContainer", {
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
  useBrowserRecommendedResolution: true,
});

scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.debugShowFramesPerSecond = true;
scene.highDynamicRange = true;

bloom = scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.glowOnly = false;
bloom.uniforms.contrast = 128.0; // 強めのコントラスト
bloom.uniforms.brightness = -0.4; // しきい値を下げる
bloom.uniforms.delta = 0.9;
bloom.uniforms.sigma = 4.0;
bloom.uniforms.stepSize = 1.0;

const buildingStyleOpacity = 0.7;
const buildingStyleTintHex = "#5fd4ff";
const buildingTilesets = [];
let buildingSilhouetteStage;
const buildingSilhouetteColor = Cesium.Color.fromCssColorString(
  buildingStyleTintHex,
  new Cesium.Color()
);
buildingSilhouetteColor.alpha = 1.0;

const applyBuildingStyle = (tileset) => {
  tileset.style = new Cesium.Cesium3DTileStyle({
    color: `vec4(
      mix(color('${buildingStyleTintHex}').r, color().r, 0.7),
      mix(color('${buildingStyleTintHex}').g, color().g, 0.7),
      mix(color('${buildingStyleTintHex}').b, color().b, 0.7),
      ${buildingStyleOpacity}
    )`,
  });
};

const registerBuildingForSilhouette = (tileset) => {
  buildingTilesets.push(tileset);
  if (!buildingSilhouetteStage) {
    buildingSilhouetteStage =
      Cesium.PostProcessStageLibrary.createSilhouetteStage();
    buildingSilhouetteStage.uniforms.color = Cesium.Color.clone(
      buildingSilhouetteColor,
      new Cesium.Color()
    );
    buildingSilhouetteStage.uniforms.length = 0.002;
    scene.postProcessStages.add(buildingSilhouetteStage);
  }
  buildingSilhouetteStage.selected = buildingTilesets;
};

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
  applyBuildingStyle(taito);
  registerBuildingForSilhouette(taito);

  // 墨田区のLOD2のビルデータを読み込む
  const sumida = await Cesium.Cesium3DTileset.fromUrl(
    "https://assets.cms.plateau.reearth.io/assets/5d/526931-ac09-44b4-a910-d2331d69c87a/13107_sumida-ku_city_2024_citygml_1_op_bldg_3dtiles_13107_sumida-ku_lod3_no_texture/tileset.json"
  );
  applyBuildingStyle(sumida);
  registerBuildingForSilhouette(sumida);

  scene.primitives.add(taito);
  scene.primitives.add(sumida);
} catch (error) {
  console.log(error);
}

setup();
const xMin = -100.0;
const xMax = 100.0;
const yMin = -80.0;
const yMax = 100.0;
const zMin = -50.0;
const zMax = 50.0;
const number = 400;

// Particle system setup using point primitives

const pointsNumber = number;
const times = 5;
const delayStep = 0.005;
const totalInstances = pointsNumber * times;
const positions = new Float32Array(pointsNumber * 3 * times);
const delays = new Float32Array(pointsNumber * times);
const angles = new Float32Array(pointsNumber * times);
for (let i = 0; i < pointsNumber; i++) {
  const x = 1e-9;
  const y = 0.0;
  const z = 200.0;

  for (let j = 0; j < times; j++) {
    const idx3 = (i * times + j) * 3;
    const index = i * times + j;
    const angle = (index / totalInstances) * Cesium.Math.TWO_PI;

    // 座標
    positions[idx3 + 0] = x;
    positions[idx3 + 1] = y;
    positions[idx3 + 2] = z;

    delays[index] = j * delayStep;
    angles[index] = angle;
  }
}

const geometry = new Cesium.Geometry({
  attributes: {
    position: new Cesium.GeometryAttribute({
      componentDatatype: Cesium.ComponentDatatype.DOUBLE,
      componentsPerAttribute: 3,
      values: positions,
    }),
    pointDelay: new Cesium.GeometryAttribute({
      componentDatatype: Cesium.ComponentDatatype.FLOAT,
      componentsPerAttribute: 1,
      values: delays,
    }),
    pointAngle: new Cesium.GeometryAttribute({
      componentDatatype: Cesium.ComponentDatatype.FLOAT,
      componentsPerAttribute: 1,
      values: angles,
    }),
  },
  primitiveType: Cesium.PrimitiveType.POINTS,
  boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
});

const appearance = new Cesium.MaterialAppearance({
  flat: true,
  faceForward: true,
  translucent: true,
  closed: false,
  vertexShaderSource: `
    in vec3 position3DHigh;
    in vec3 position3DLow;
    in float batchId;
    in float pointDelay;
    in float pointAngle;

    // 点サイズ
    uniform float u_pointSize;
    uniform float u_time;
    uniform float u_period;
    uniform float u_radius;

    void main() {
      float safePeriod = max(u_period, 1e-6);
      float elapsed = max(u_time - pointDelay, 0.0);
      float cycle = mod(elapsed, safePeriod);
      float normalized = cycle / safePeriod;
      float radialFactor = clamp(sin(normalized * czm_pi), 0.0, 1.0);
      float radius = radialFactor * u_radius;

      vec3 direction = vec3(cos(pointAngle), sin(pointAngle), 0.0);
      vec3 modelOffset = direction * radius;

      vec4 p = czm_computePosition();
      vec3 eyeOffset = (czm_modelViewRelativeToEye * vec4(modelOffset, 0.0)).xyz;
      p.xyz += eyeOffset;

      gl_Position = czm_modelViewProjectionRelativeToEye * p;
      gl_PointSize = u_pointSize;
    }
  `,
  fragmentShaderSource: `
    uniform vec4 u_color;
    void main() {
      // 円形スプライトにしたい場合は距離でマスク
      vec2 uv = gl_PointCoord - 0.5;
      if (length(uv) > 0.5) discard;

      out_FragColor = u_color;
    }
  `,
  materialCacheKey: "simple-points",
});

appearance.uniforms = {
  u_color: Cesium.Color.fromCssColorString(
    params.fireworkColor,
    new Cesium.Color()
  ),
  u_pointSize: 5.0,
  u_time: 0.0,
  u_period: 4.0,
  u_radius: 120.0,
};

const setPointColorFromHex = (hex) => {
  if (!hex) {
    return;
  }
  const color = Cesium.Color.fromCssColorString(
    hex,
    appearance.uniforms.u_color
  );
  if (!color) {
    console.warn(`Invalid firework color "${hex}".`);
    return;
  }
  appearance.uniforms.u_color = color;
};
setPointColorFromHex(params.fireworkColor);

const instance = new Cesium.GeometryInstance({ geometry });
const primitive = new Cesium.Primitive({
  geometryInstances: instance,
  appearance,
  asynchronous: false,
  modelMatrix,
});
scene.primitives.add(primitive);

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

scene.globe.enableLighting = true;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  threeRenderer.setSize(width, height);
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();
});

const fireworkColorButtons = document.querySelectorAll(
  ".firework-color-button"
);
let fireworkColorBinding;
let activeFireworkColorKey = defaultFireworkColorKey;

function setActiveFireworkButton(colorKey) {
  fireworkColorButtons.forEach((button) => {
    const buttonKey = button.dataset.fireworkColor;
    button.classList.toggle("is-active", buttonKey === colorKey);
  });
}

const resolveFireworkHex = (colorKeyOrHex) => {
  if (!colorKeyOrHex) {
    return undefined;
  }
  if (colorKeyOrHex.startsWith("#")) {
    return colorKeyOrHex;
  }
  return fireworkColorPresets[colorKeyOrHex];
};

function updateFireworkColors(colorKeyOrHex) {
  const colorHex = resolveFireworkHex(colorKeyOrHex);
  if (!colorHex) {
    console.warn(`Firework color "${colorKeyOrHex}" is not defined.`);
    return;
  }
  activeFireworkColorKey = colorKeyOrHex;
  params.fireworkColor = colorHex;
  setPointColorFromHex(colorHex);
  if (fireworkColorBinding) {
    fireworkColorBinding.refresh();
  }
  setActiveFireworkButton(colorKeyOrHex);
}

if (fireworkColorButtons.length > 0) {
  fireworkColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const colorKey = button.dataset.fireworkColor;
      if (!colorKey || colorKey === activeFireworkColorKey) {
        return;
      }
      updateFireworkColors(colorKey);
    });
  });

  updateFireworkColors(activeFireworkColorKey);
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

let animationStart;

function animate(timestamp) {
  if (animationStart === undefined) {
    animationStart = timestamp;
  }
  const elapsedSeconds = (timestamp - animationStart) * 0.001;
  appearance.uniforms.u_time = elapsedSeconds;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

const createDebugPane = () => {
  fireworkColorBinding = pane
    .addBinding(params, "fireworkColor")
    .on("change", (event) => {
      updateFireworkColors(event.value);
    });
};

createDebugPane();

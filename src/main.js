import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { Pane } from "tweakpane";

const isDebugMode = true;

const pane = new Pane();

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const fireWorkCategory = {
  kiku: "菊",
  botan: "牡丹",
  meshibe: "めしべ",
  heart: "ハート",
  love: "告白",
};

const params = {
  category: fireWorkCategory.kiku,
  numberOfParticles: 400,
  pointSize: 3.0,
  radius: 100,
  fireworkColor: "#ffd700",
  launchDuration: 2.0,
  bloomDuration: 3.0,
  fireworkDuration: 5.0,
  times: 75,
  buildingColor: "#5fd4ff",
  buildingOpacity: 0.7,
  launchOffsetRangeMeters: 100.0,
  height: 200,
};
let viewer, scene;
let bloom;

const location = {
  lat: 35.716833,
  lng: 139.805278,
  height: 250,
};
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(location.lng, location.lat)
);

const fireworkColorPresets = {
  gold: { hex: "#ffd700", secondary: "cyan" },
  magenta: { hex: "#ff4dff", secondary: "white" },
  cyan: { hex: "#4dd2ff", secondary: "gold" },
  white: { hex: "#ffffff", secondary: "magenta" },
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

const buildingTilesets = [];
let buildingSilhouetteStage;
const buildingSilhouetteColor = Cesium.Color.fromCssColorString(
  params.buildingColor,
  new Cesium.Color()
);
buildingSilhouetteColor.alpha = 1.0;

const applyBuildingStyle = (tileset) => {
  tileset.style = new Cesium.Cesium3DTileStyle({
    color: `vec4(
      mix(color('${params.buildingColor}').r, color().r, ${params.buildingOpacity}),
      mix(color('${params.buildingColor}').g, color().g, ${params.buildingOpacity}),
      mix(color('${params.buildingColor}').b, color().b, ${params.buildingOpacity}),
      ${params.buildingOpacity}
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

if (!isDebugMode) {
  viewer.camera.setView(initialJapanView);
}

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

// Particle system setup using point primitives
const defaultDelayStep = 0.005;
const defaultLaunchIntervalSeconds = 1.0;
const fireworks = [];
const launchSequences = new Set();
const launchOffsetScratch = new Cesium.Cartesian3();
const launchTranslationScratch = new Cesium.Matrix4();

function randomPointOnSphere(radius = 1) {
  const u = Math.random();
  const v = Math.random();

  const theta = 2 * Math.PI * u; // 経度
  const phi = Math.acos(2 * v - 1); // 緯度（均等化）

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);

  return { x, y, z }; // Vector3の代わりにオブジェクト
}

const fireworkVertexShaderSource = `
    in vec3 position3DHigh;
    in vec3 position3DLow;
    in float batchId;
    in float delay;
    in vec3 unitDir;

    // 点サイズ
    uniform float u_pointSize;
    uniform float u_time;
    uniform float u_amplitude;
    uniform float u_period;
    uniform float u_radius;
    uniform float u_launchHeight;
    uniform float u_launchProgress;
    uniform float u_bloomDuration;

    float easingOutQuint(float t) {
      return 1.0 - pow(1.0 - t, 5.0);
    }

    void main() {
      vec4 p = czm_translateRelativeToEye(position3DHigh, position3DLow);
      vec3 dir = unitDir;

      float t = max(u_time - delay, 0.0);

      float d1 = easingOutQuint(t / u_bloomDuration);
      float grav = 9.8;
      vec3 gravP = vec3(0., 0., -1.) * (t * t * grav) * 0.5;
      float launchProgress = clamp(u_launchProgress, 0.0, 1.0);
      float launchOffset = u_launchHeight * launchProgress;
      vec3 newP = (p.xyz + dir * d1 * u_radius) + gravP;
      newP.z += launchOffset;
      p.xyz = newP;

      gl_Position = czm_modelViewProjectionRelativeToEye * vec4(p.xyz, 1.);
      gl_PointSize = u_pointSize* (1.- delay * 1.);
    }
  `;

const fireworkFragmentShaderSource = `
    uniform vec4 u_color;
    uniform float u_time;
    uniform float u_bloomDuration;

    void main() {
      // 円形スプライトにしたい場合は距離でマスク
      vec2 uv = gl_PointCoord - 0.5;
      if (length(uv) > 0.5) discard;

      float alpha = 1. - smoothstep(0.0, 1.0, u_time / u_bloomDuration);

      out_FragColor = vec4(u_color.xyz, u_color.a * alpha);
    }
  `;

const createFireworkMaterial = () =>
  new Cesium.MaterialAppearance({
    translucent: true,
    closed: false,
    vertexShaderSource: fireworkVertexShaderSource,
    fragmentShaderSource: fireworkFragmentShaderSource,
    materialCacheKey: "simple-points",
  });

export const createFirework = (options = {}) => {
  const {
    numberOfParticles = params.numberOfParticles,
    times = params.times,
    pointSize = params.pointSize,
    radius = params.radius,
    fireworkColor = params.fireworkColor,
    launchDuration = params.launchDuration,
    bloomDuration = params.bloomDuration,
    launchHeight = params.height,
    delayStep = defaultDelayStep,
    matrix = modelMatrix,
  } = options;

  const positions = new Float32Array(numberOfParticles * 3 * times);
  const delays = new Float32Array(numberOfParticles * times);
  const unitDirs = new Float32Array(numberOfParticles * 3 * times);

  const category = params.category;
  if (category === fireWorkCategory.heart) {
    gltfLoader.load("./models.glb", (gltf) => {
      particles = {};
      particles.index = 0;

      // Positions
      const positions = gltf.scene.children.map(
        (child) => child.geometry.attributes.position
      );
    });
  } else {
    for (let i = 0; i < numberOfParticles; i++) {
      const point = randomPointOnSphere(0.1);
      const len = Math.hypot(point.x, point.y, point.z) || 1.0;
      const ux = point.x / len;
      const uy = point.y / len;
      const uz = point.z / len;

      for (let j = 0; j < times; j++) {
        const idx3 = (i * times + j) * 3;
        const delayIndex = i * times + j;

        positions[idx3 + 0] = point.x;
        positions[idx3 + 1] = point.y;
        positions[idx3 + 2] = point.z;

        unitDirs[idx3 + 0] = ux;
        unitDirs[idx3 + 1] = uy;
        unitDirs[idx3 + 2] = uz;

        delays[delayIndex] = j * delayStep;
      }
    }
  }

  const geometry = new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      delay: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 1,
        values: delays,
      }),
      unitDir: new Cesium.GeometryAttribute({
        componentDatatype: Cesium.ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: unitDirs,
      }),
    },
    primitiveType: Cesium.PrimitiveType.POINTS,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
  });

  const appearance = createFireworkMaterial();
  appearance.uniforms = {
    u_color: Cesium.Color.fromCssColorString(fireworkColor, new Cesium.Color()),
    u_pointSize: pointSize,
    u_time: 0.0,
    u_radius: radius,
    u_duration: launchDuration,
    u_launchHeight: launchHeight,
    u_bloomDuration: bloomDuration,
    u_launchProgress: 0.0,
  };

  const instance = new Cesium.GeometryInstance({ geometry });
  const primitive = new Cesium.Primitive({
    geometryInstances: instance,
    appearance,
    asynchronous: false,
    modelMatrix: matrix,
  });
  scene.primitives.add(primitive);

  const firework = {
    primitive,
    appearance,
    startTime: undefined,
  };
  fireworks.push(firework);
  return firework;
};

const createRandomizedLaunchMatrix = (
  baseMatrix = modelMatrix,
  spreadMeters = params.launchOffsetRangeMeters
) => {
  const offsetX = (Math.random() - 0.5) * 2.0 * spreadMeters;
  const offsetY = (Math.random() - 0.5) * 2.0 * spreadMeters;
  Cesium.Cartesian3.fromElements(offsetX, offsetY, 0.0, launchOffsetScratch);
  Cesium.Matrix4.fromTranslation(launchOffsetScratch, launchTranslationScratch);
  return Cesium.Matrix4.multiply(
    baseMatrix,
    launchTranslationScratch,
    new Cesium.Matrix4()
  );
};

const stopLaunchSequence = (sequence) => {
  if (!sequence) {
    return;
  }
  sequence.active = false;
  if (sequence.timeoutId) {
    window.clearTimeout(sequence.timeoutId);
  }
  launchSequences.delete(sequence);
};

const stopAllLaunchSequences = () => {
  Array.from(launchSequences).forEach((sequence) => {
    stopLaunchSequence(sequence);
  });
};

const launchFireworkSequence = (options = {}, fireworkFactory) => {
  const durationSeconds = options.duration ?? params.fireworkDuration;
  const intervalSeconds = Math.max(
    options.interval ?? defaultLaunchIntervalSeconds,
    0.1
  );
  const baseMatrix = options.matrix || modelMatrix;
  const spread = options.spread ?? params.launchOffsetRangeMeters;
  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const startTime = now();
  const sequence = {
    active: true,
    timeoutId: undefined,
  };
  const defaultFactory = (matrix) => {
    createFirework({
      numberOfParticles: options.numberOfParticles,
      times: options.times,
      pointSize: options.pointSize,
      radius: options.radius,
      fireworkColor: options.fireworkColor ?? params.fireworkColor,
      launchDuration: options.launchDuration,
      bloomDuration: options.bloomDuration,
      launchHeight: options.launchHeight,
      delayStep: options.delayStep,
      matrix,
    });
  };
  const spawnFirework =
    typeof fireworkFactory === "function" ? fireworkFactory : defaultFactory;

  const launchOnce = () => {
    if (!sequence.active) {
      return;
    }
    const elapsedSeconds = (now() - startTime) * 0.001;
    if (elapsedSeconds > durationSeconds) {
      stopLaunchSequence(sequence);
      return;
    }

    const fireworkMatrix = createRandomizedLaunchMatrix(baseMatrix, spread);
    spawnFirework(fireworkMatrix);

    sequence.timeoutId = window.setTimeout(launchOnce, intervalSeconds * 1000);
  };

  launchSequences.add(sequence);
  launchOnce();
  return () => stopLaunchSequence(sequence);
};

const startFireworkShow = () => {
  stopAllLaunchSequences();
  const category = params.category;

  if (category === fireWorkCategory.botan) {
    const innerRadius = params.radius * 0.6;
    const outerRadius = params.radius * 1.2;
    const primaryPresetKey = activeFireworkColorKey ?? defaultFireworkColorKey;
    const secondaryPresetKey = resolveSecondaryPresetKey(primaryPresetKey);
    const primaryColorHex =
      resolveFireworkHex(primaryPresetKey) ?? params.fireworkColor;
    const secondaryColorHex =
      resolveFireworkHex(secondaryPresetKey) ?? params.fireworkColor;
    launchFireworkSequence({}, (matrix) => {
      createFirework({
        radius: innerRadius,
        matrix,
        fireworkColor: primaryColorHex,
      });
      createFirework({
        radius: outerRadius,
        matrix,
        fireworkColor: secondaryColorHex,
      });
    });
    return;
  }

  launchFireworkSequence();
};

const getPrimaryAppearance = () => fireworks[0]?.appearance;

const setPointColorFromHex = (
  hex,
  targetAppearance = getPrimaryAppearance()
) => {
  if (!hex || !targetAppearance) {
    return;
  }
  const baseColor = targetAppearance.uniforms.u_color || new Cesium.Color();
  const color = Cesium.Color.fromCssColorString(hex, baseColor);
  if (!color) {
    console.warn(`Invalid firework color "${hex}".`);
    return;
  }
  targetAppearance.uniforms.u_color = color;
};

const primaryFirework = createFirework();
setPointColorFromHex(params.fireworkColor, primaryFirework.appearance);

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
  if (typeof colorKeyOrHex === "string" && colorKeyOrHex.startsWith("#")) {
    return colorKeyOrHex;
  }
  return fireworkColorPresets[colorKeyOrHex]?.hex;
};

const resolveFireworkPresetKey = (colorKeyOrHex) => {
  if (!colorKeyOrHex) {
    return undefined;
  }
  const isHex =
    typeof colorKeyOrHex === "string" && colorKeyOrHex.startsWith("#");
  if (!isHex && fireworkColorPresets[colorKeyOrHex]) {
    return colorKeyOrHex;
  }
  const hexValue = isHex
    ? colorKeyOrHex
    : fireworkColorPresets[colorKeyOrHex]?.hex;
  if (typeof hexValue !== "string") {
    return undefined;
  }
  const normalizedHex = hexValue.toLowerCase();
  const match = Object.entries(fireworkColorPresets).find(
    ([, preset]) => preset.hex.toLowerCase() === normalizedHex
  );
  return match?.[0];
};

const resolveSecondaryPresetKey = (primaryKey) =>
  fireworkColorPresets[primaryKey]?.secondary ?? defaultFireworkColorKey;

function updateFireworkColors(colorKeyOrHex) {
  const colorHex = resolveFireworkHex(colorKeyOrHex);
  if (!colorHex) {
    console.warn(`Firework color "${colorKeyOrHex}" is not defined.`);
    return;
  }
  const presetKey = resolveFireworkPresetKey(colorKeyOrHex);
  if (presetKey) {
    activeFireworkColorKey = presetKey;
  }
  params.fireworkColor = colorHex;
  fireworks.forEach((firework) => {
    setPointColorFromHex(colorHex, firework.appearance);
  });
  if (fireworkColorBinding) {
    fireworkColorBinding.refresh();
  }
  setActiveFireworkButton(activeFireworkColorKey);
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
const defaultFireworksOffset = new Cesium.HeadingPitchRange(
  initialViewHeading,
  initialViewPitch,
  initialViewRange
);
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
      offset: defaultFireworksOffset,
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
    startFireworkShow();
  });
} else {
  startFireworkShow();
}

if (resetCameraButton) {
  resetCameraButton.addEventListener("click", () => {
    viewer.camera.cancelFlight();
    clearHighlightedBuilding();
    setResetCameraButtonVisible(false);
    flyToDefaultFireworksView();
  });
}

const setInitialFireworksView = () => {
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(fireworksFocus, 1.0),
    {
      offset: defaultFireworksOffset,
      duration: 0.0,
      complete: () => {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        setResetCameraButtonVisible(false);
      },
    }
  );
};
setInitialFireworksView();

function animate(timestamp) {
  fireworks.forEach((firework) => {
    if (!firework.startTime) {
      firework.startTime = timestamp;
    }
    const uniforms = firework.appearance?.uniforms;
    if (!uniforms) {
      return;
    }
    const elapsedSeconds = (timestamp - firework.startTime) * 0.001;
    const launchDuration = Math.max(
      uniforms.u_duration || params.launchDuration,
      1e-6
    );
    const launchProgress = Math.min(elapsedSeconds / launchDuration, 1.0);
    uniforms.u_launchProgress = launchProgress;
    const explosionTime = Math.max(elapsedSeconds - launchDuration, 0.0);
    uniforms.u_time = explosionTime;
  });
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

const createDebugPane = () => {
  pane
    .addBinding(params, "category", {
      options: fireWorkCategory,
    })
    .on("change", () => {
      startFireworkShow();
    });

  pane
    .addBinding(params, "numberOfParticles", {
      min: 100,
      max: 1000,
      step: 10,
    })
    .on("change", (event) => {
      createFirework({
        numberOfParticles: event.value,
      });
    });

  fireworkColorBinding = pane
    .addBinding(params, "fireworkColor")
    .on("change", (event) => {
      updateFireworkColors(event.value);
    });

  pane
    .addBinding(params, "pointSize", {
      min: 0.1,
      max: 10,
    })
    .on("change", (event) => {
      fireworks.forEach((firework) => {
        firework.appearance.uniforms.u_pointSize = event.value;
      });
    });

  pane
    .addBinding(params, "radius", {
      min: 10,
      max: 500,
    })
    .on("change", (event) => {
      fireworks.forEach((firework) => {
        firework.appearance.uniforms.u_radius = event.value;
      });
    });

  pane
    .addBinding(params, "launchDuration", {
      min: 0.1,
      max: 10,
    })
    .on("change", (event) => {
      fireworks.forEach((firework) => {
        firework.appearance.uniforms.u_duration = event.value;
      });
    });

  pane
    .addBinding(params, "bloomDuration", {
      min: 0.1,
      max: 10,
    })
    .on("change", (event) => {
      fireworks.forEach((firework) => {
        firework.appearance.uniforms.u_bloomDuration = event.value;
      });
    });

  pane
    .addBinding(params, "fireworkDuration", {
      min: 1,
      max: 60,
    })
    .on("change", () => {
      startFireworkShow();
    });

  pane
    .addBinding(params, "times", {
      min: 1,
      max: 50,
      step: 1,
    })
    .on("change", (event) => {
      // 再読み込みして反映させる
      window.location.reload();
    });

  pane.addBinding(params, "buildingColor").on("change", (event) => {
    const colorHex = event.value;
    Cesium.Color.fromCssColorString(colorHex, buildingSilhouetteColor);
    buildingTilesets.forEach((tileset) => {
      applyBuildingStyle(tileset);
    });
    if (buildingSilhouetteStage) {
      buildingSilhouetteStage.uniforms.color = Cesium.Color.clone(
        buildingSilhouetteColor,
        new Cesium.Color()
      );
    }
  });

  pane
    .addBinding(params, "buildingOpacity", {
      min: 0.0,
      max: 1.0,
    })
    .on("change", (event) => {
      const opacity = event.value;
      buildingTilesets.forEach((tileset) => {
        applyBuildingStyle(tileset);
      });
    });
};

createDebugPane();

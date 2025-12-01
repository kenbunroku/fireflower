import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

import FireworkManager from "./FireworkManager";
import { rotatePositionsAroundX } from "./util.js";
import {
  category,
  defaultFireworkColorKey,
  fireWorkCategory,
  fireworkColorPresets,
  isDebugMode,
  location,
  maxTimelineSelections,
  params,
  roofViewOffsetMeters,
  timelineModeIcons,
  timelineModeLabels,
  timelinePlaybackDurationMs,
} from "./constant.js";

const cesiumAccessToken = import.meta.env?.VITE_CESIUM_ACCESS_TOKEN;
if (!cesiumAccessToken) {
  console.error(
    "Cesium access token is missing. Set VITE_CESIUM_ACCESS_TOKEN in your .env file."
  );
} else {
  Cesium.Ion.defaultAccessToken = cesiumAccessToken;
}

let isRandomFireworkOnLaunch = true;

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./static/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let heartModelPositions = new Float32Array();
let loveModelPositions = new Float32Array();

const loadGltfModelPositions = (modelPath, onPositionsLoaded) => {
  gltfLoader.load(
    modelPath,
    (gltf) => {
      const positionAttributes = [];

      gltf.scene.traverse((child) => {
        if (!child.isMesh) {
          return;
        }
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const positionAttr = geo.attributes?.position;
        if (positionAttr?.array) {
          positionAttributes.push(positionAttr.array);
        }
      });

      const basePositions = positionAttributes[0];
      const rotatedPositions = basePositions
        ? rotatePositionsAroundX(basePositions, Math.PI / 2)
        : new Float32Array();
      onPositionsLoaded(rotatedPositions);
    },
    undefined,
    (error) => {
      console.error(`Failed to load model from ${modelPath}`, error);
      onPositionsLoaded(new Float32Array());
    }
  );
};

const gltfModels = {
  heart: {
    path: "./heart.glb",
    onLoad: (positions) => {
      heartModelPositions = positions;
      category.heart.numberOfParticles = positions.length / 3;
    },
  },
  love: {
    path: "./merryme.glb",
    onLoad: (positions) => {
      loveModelPositions = positions;
      category.love.numberOfParticles = positions.length / 3;
    },
  },
};

const whizzlingSoundPath = "/sound/whizzling.mp3";
const bloomSoundPaths = [
  "/sound/bloom.mp3",
  "/sound/bloom2.mp3",
  "/sound/bloom3.mp3",
];
let audioContext;
let whizzlingBuffer;
let bloomBuffers = [];
let audioInitPromise;
let hasPrimedAudio = false;
let isAudioEnabled = true;
let audioToggleButton;
let audioToggleIcon;

const ensureAudioContext = () => {
  if (audioContext) {
    return audioContext;
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    console.warn("Web Audio API is not supported in this browser.");
    return undefined;
  }
  audioContext = new AudioCtx();
  return audioContext;
};

const resumeAudioContext = () => {
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== "suspended") {
    return Promise.resolve(ctx);
  }
  return ctx
    .resume()
    .then(() => ctx)
    .catch((error) => {
      console.warn("Failed to resume audio context.", error);
      return ctx;
    });
};

const loadAudioBuffer = async (path) => {
  const ctx = ensureAudioContext();
  if (!ctx) {
    return undefined;
  }
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("Failed to load audio buffer:", error);
    return undefined;
  }
};

const initAudio = () => {
  if (audioInitPromise) {
    return audioInitPromise;
  }
  const ctx = ensureAudioContext();
  if (!ctx) {
    return undefined;
  }
  audioInitPromise = Promise.all([
    loadAudioBuffer(whizzlingSoundPath),
    Promise.all(bloomSoundPaths.map((path) => loadAudioBuffer(path))),
  ])
    .then(([whizz, bloomList]) => {
      whizzlingBuffer = whizz;
      bloomBuffers = Array.isArray(bloomList)
        ? bloomList.filter((buffer) => Boolean(buffer))
        : [];
      return { whizz, bloom: bloomBuffers };
    })
    .catch((error) => {
      console.error("Failed to initialize audio.", error);
      audioInitPromise = undefined;
    });
  return audioInitPromise;
};

const playAudioBuffer = (buffer, { volume = 1 } = {}) => {
  if (!isAudioEnabled) {
    return;
  }
  const ctx = ensureAudioContext();
  if (!ctx || !buffer) {
    return;
  }
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(gainNode).connect(ctx.destination);
  source.start();
  return source;
};

const playWhizzlingSound = () => {
  if (!isAudioEnabled) {
    return;
  }
  const initPromise = initAudio();
  if (!initPromise) {
    return;
  }
  initPromise
    .then(() => resumeAudioContext())
    .then(() => {
      if (whizzlingBuffer) {
        playAudioBuffer(whizzlingBuffer, { volume: 0.35 });
      }
    })
    .catch((error) => console.warn("Failed to play whizzling sound.", error));
};

const playBloomSound = () => {
  if (!isAudioEnabled) {
    return;
  }
  const initPromise = initAudio();
  if (!initPromise) {
    return;
  }
  initPromise
    .then(() => resumeAudioContext())
    .then(() => {
      if (bloomBuffers.length > 0) {
        const index = Math.floor(Math.random() * bloomBuffers.length);
        const buffer = bloomBuffers[index];
        if (buffer) {
          playAudioBuffer(buffer, { volume: 0.45 });
        }
      }
    })
    .catch((error) => console.warn("Failed to play bloom sound.", error));
};

const primeAudioOnInteraction = () => {
  if (typeof window === "undefined") {
    return;
  }
  const unlock = () => {
    if (hasPrimedAudio) {
      return;
    }
    hasPrimedAudio = true;
    initAudio();
    resumeAudioContext();
  };
  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { once: true });
  });
};

primeAudioOnInteraction();

const updateAudioToggleButton = () => {
  if (!audioToggleButton || !audioToggleIcon) {
    return;
  }
  audioToggleIcon.textContent = isAudioEnabled ? "volume_up" : "volume_off";
  audioToggleButton.setAttribute("aria-pressed", String(isAudioEnabled));
  audioToggleButton.setAttribute(
    "aria-label",
    isAudioEnabled ? "音声オン" : "音声オフ"
  );
  audioToggleButton.title = isAudioEnabled ? "音声オン" : "音声オフ";
};

const setAudioEnabled = (enabled) => {
  isAudioEnabled = Boolean(enabled);
  updateAudioToggleButton();
  if (!isAudioEnabled) {
    if (audioContext?.state === "running" && audioContext?.suspend) {
      audioContext.suspend();
    }
    return;
  }
  initAudio();
  resumeAudioContext();
};

let viewer, scene;
let bloom;

const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(location.lng, location.lat)
);

const setup = () => {
  setupPlateauAssets();
  Object.values(gltfModels).map((model) =>
    loadGltfModelPositions(model.path, model.onLoad)
  );
  setupBloom();
};

const setupPlateauAssets = async () => {};

const setupBloom = () => {
  if (!scene || !scene.postProcessStages) {
    console.warn("Cesium scene is not ready for bloom setup.");
    return;
  }

  if (bloom) {
    return;
  }

  const postProcessStages = scene.postProcessStages;
  bloom =
    postProcessStages.bloom ||
    postProcessStages.add(Cesium.PostProcessStageLibrary.createBloomStage());

  if (!bloom) {
    console.warn("Unable to initialize bloom post process stage.");
    return;
  }

  bloom.enabled = true;
  bloom.uniforms.glowOnly = false;
  bloom.uniforms.contrast = 128.0; // 強めのコントラスト
  bloom.uniforms.brightness = -0.4; // しきい値を下げる
  bloom.uniforms.delta = 0.9;
  bloom.uniforms.sigma = 4.0;
  bloom.uniforms.stepSize = 1.0;
};

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
  geocoder: false,
});

const mapboxAccessToken = import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN;
viewer.imageryLayers.removeAll();
viewer.imageryLayers.addImageryProvider(
  new Cesium.MapboxStyleImageryProvider({
    styleId: "navigation-night-v1",
    accessToken: mapboxAccessToken,
  })
);

const controlPanelButtons = document.querySelector(".control-panel__buttons");
const fullscreenContainer =
  viewer?.fullscreenButton?.container ||
  viewer.container.querySelector(".cesium-viewer-fullscreenContainer");
const controlPanelContainer = document.querySelector(
  ".control-panel-container"
);
const sidebar = document.getElementById("sidebar");

if (controlPanelButtons && fullscreenContainer) {
  fullscreenContainer.classList.add("control-panel__fullscreen");
  controlPanelButtons.insertBefore(
    fullscreenContainer,
    controlPanelButtons.querySelector(".open__button")
  );
}

if (controlPanelButtons) {
  audioToggleButton = document.createElement("button");
  audioToggleButton.type = "button";
  audioToggleButton.className = "control-panel__audio-toggle";
  audioToggleIcon = document.createElement("span");
  audioToggleIcon.className = "material-icons-outlined";
  audioToggleButton.appendChild(audioToggleIcon);
  audioToggleButton.addEventListener("click", () =>
    setAudioEnabled(!isAudioEnabled)
  );
  const openButton = controlPanelButtons.querySelector(".open__button");
  if (openButton) {
    controlPanelButtons.insertBefore(audioToggleButton, openButton);
  } else {
    controlPanelButtons.appendChild(audioToggleButton);
  }
  updateAudioToggleButton();
}

const updateControlPanelOffset = () => {
  if (!controlPanelContainer || !sidebar) {
    return;
  }
  controlPanelContainer.classList.toggle(
    "is-open",
    sidebar.matches(":popover-open")
  );
};

if (sidebar) {
  sidebar.addEventListener("toggle", updateControlPanelOffset);
  updateControlPanelOffset();
}

scene = viewer.scene;
scene.globe.depthTestAgainstTerrain = true;
scene.debugShowFramesPerSecond = true;
scene.highDynamicRange = true;

const buildingTilesets = [];
let buildingSilhouetteStage;
const buildingSilhouetteColor = Cesium.Color.fromCssColorString(
  params.buildingColor,
  new Cesium.Color()
);
buildingSilhouetteColor.alpha = 1.0;

// Buildings load a lot of tiles; keep the budget small and let Cesium skip to coarser LODs.
const tilesetPerformanceOptions = {
  maximumScreenSpaceError: 32,
  dynamicScreenSpaceError: true,
  dynamicScreenSpaceErrorFactor: 2.5,
  dynamicScreenSpaceErrorDensity: 0.0025,
  skipLevelOfDetail: true,
  baseScreenSpaceError: 1024,
  skipScreenSpaceErrorFactor: 16,
  skipLevels: 1,
  maximumNumberOfLoadedTiles: 256,
  maximumMemoryUsage: 256,
  cullRequestsWhileMoving: true,
  cullRequestsWhileMovingMultiplier: 10.0,
};

const applyTilesetPerformanceTuning = (tileset) => {
  if (!tileset) {
    return;
  }
  Object.entries(tilesetPerformanceOptions).forEach(([key, value]) => {
    if (key in tileset) {
      tileset[key] = value;
    }
  });
};

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

const loadBuildingTilesets = async () => {
  const startFireworksWhenVisible = (tileset) => {
    const handleFirstVisibility = () => {
      tileset.tileVisible.removeEventListener(handleFirstVisibility);
      startInitialFireworks();
    };
    tileset.tileVisible.addEventListener(handleFirstVisibility);
  };

  try {
    // 台東区のLOD2のビルデータを読み込む
    const taito = await Cesium.Cesium3DTileset.fromUrl(
      "https://assets.cms.plateau.reearth.io/assets/59/0fbb20-59cb-4ce5-9d12-2273ce72e6d2/13106_taito-ku_city_2024_citygml_1_op_bldg_3dtiles_13106_taito-ku_lod2_no_texture/tileset.json"
    );
    applyTilesetPerformanceTuning(taito);
    applyBuildingStyle(taito);
    registerBuildingForSilhouette(taito);
    startFireworksWhenVisible(taito);

    // 墨田区のLOD2のビルデータを読み込む
    const sumida = await Cesium.Cesium3DTileset.fromUrl(
      "https://assets.cms.plateau.reearth.io/assets/5d/526931-ac09-44b4-a910-d2331d69c87a/13107_sumida-ku_city_2024_citygml_1_op_bldg_3dtiles_13107_sumida-ku_lod3_no_texture/tileset.json"
    );
    applyTilesetPerformanceTuning(sumida);
    applyBuildingStyle(sumida);
    registerBuildingForSilhouette(sumida);
    startFireworksWhenVisible(sumida);

    scene.primitives.add(taito);
    scene.primitives.add(sumida);
  } catch (error) {
    console.log(error);
    startInitialFireworks();
    return;
  } finally {
    if (!fireworksFallbackTimeoutId) {
      fireworksFallbackTimeoutId = window.setTimeout(
        startInitialFireworks,
        8000
      );
    }
  }
};

setup();

// Particle system setup using point primitives
const fireworkManager = new FireworkManager({
  scene,
  params,
  fireWorkCategory,
  modelMatrix,
  modelPositions: heartModelPositions,
});
const fireworks = [];
let fireworksInitialized = false;
let fireworksFallbackTimeoutId;

const resetFireworkAudioState = (firework) => {
  if (!firework) {
    return;
  }
  firework.audioState = { launchPlayed: false, bloomPlayed: false };
};

const handleFireworkAudio = ({ firework, stage, hasStarted }) => {
  if (!firework || !hasStarted) {
    return;
  }
  if (!firework.audioState) {
    resetFireworkAudioState(firework);
  }
  const state = firework.audioState;
  if (stage === "launch" && !state.launchPlayed) {
    state.launchPlayed = true;
    playWhizzlingSound();
  } else if (stage === "bloom" && !state.bloomPlayed) {
    state.bloomPlayed = true;
    playBloomSound();
  }
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

function pickRandomColorKey() {
  const presetKeys = Object.keys(fireworkColorPresets);
  if (presetKeys.length === 0) {
    return defaultFireworkColorKey;
  }
  const randomIndex = Math.floor(Math.random() * presetKeys.length);
  return presetKeys[randomIndex] ?? defaultFireworkColorKey;
}

const createRandomFirework = (startDelayMs = 0) => {
  const availableCategories = Object.entries(category)
    .filter(([, value]) => (value?.numberOfParticles ?? 0) > 0)
    .map(([key]) => key);
  const categoryKeys =
    availableCategories.length > 0
      ? availableCategories
      : Object.keys(category);
  const categoryKey =
    categoryKeys[Math.floor(Math.random() * categoryKeys.length)] || "kiku";
  const colorKey = pickRandomColorKey();
  const fireworkColor =
    fireworkColorPresets[colorKey]?.hex ?? params.fireworkColor;
  const modelPositions =
    categoryKey === "heart"
      ? heartModelPositions
      : categoryKey === "love"
      ? loveModelPositions
      : undefined;

  const firework = fireworkManager.createFirework({
    ...category[categoryKey],
    fireworkColor,
    modelPositions,
    matrix: fireworkManager.createRandomizedLaunchMatrix(),
    startDelayMs,
  });
  resetFireworkAudioState(firework);
  firework.originalColorKey = colorKey;
  firework.keepOriginalColor = true;
  fireworks.push(firework);
  return firework;
};

const createRandomFireworks = (count = 5) => {
  const total = Math.max(Math.floor(count), 0);
  for (let i = 0; i < total; i++) {
    const delayMs = i * (params.interval * 1000 || 0);
    createRandomFirework(delayMs);
  }
};
const scheduleFireworksSequentially = () => {
  const spacingMs = Math.max(params.interval * 1500, 0);
  fireworks.forEach((firework, index) => {
    firework.startDelayMs = index * spacingMs;
    firework.startTime = undefined;
    resetFireworkAudioState(firework);
  });
};

scheduleFireworksSequentially();

let isFireworksIdleLooping = false;
let fireworksIdleLoopTimeoutId;

const setFireworksVisibility = (isVisible) => {
  fireworks.forEach((firework) => {
    if (firework.primitive) {
      firework.primitive.show = isVisible;
    }
  });
};

const resetFireworksStartTimes = () => {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  fireworks.forEach((firework) => {
    firework.startTime = now;
  });
};

const stopFireworksIdleLoop = () => {
  isFireworksIdleLooping = false;
  if (fireworksIdleLoopTimeoutId) {
    window.clearTimeout(fireworksIdleLoopTimeoutId);
    fireworksIdleLoopTimeoutId = undefined;
  }
};

const getFireworksLoopDurationMs = () => {
  const spacingMs = Math.max(params.interval * 1000, 0);
  const sequentialSpanMs = spacingMs * Math.max(fireworks.length - 1, 0);
  const launchAndBloomMs =
    (params.launchDuration + params.bloomDuration + params.fireworkDuration) *
    1000;
  return Math.max(sequentialSpanMs + launchAndBloomMs, 1000);
};

const startFireworksIdleLoop = () => {
  if (fireworks.length === 0) {
    return;
  }
  stopFireworksIdleLoop();
  isFireworksIdleLooping = true;
  setFireworksVisibility(true);
  const loopDurationMs = getFireworksLoopDurationMs();
  const loop = () => {
    if (!isFireworksIdleLooping) {
      return;
    }
    scheduleFireworksSequentially();
    resetFireworksStartTimes();
    fireworksIdleLoopTimeoutId = window.setTimeout(loop, loopDurationMs);
  };
  loop();
};

const startInitialFireworks = () => {
  if (fireworksInitialized) {
    return;
  }
  if (fireworksFallbackTimeoutId) {
    window.clearTimeout(fireworksFallbackTimeoutId);
    fireworksFallbackTimeoutId = undefined;
  }
  createRandomFireworks(5);
  scheduleFireworksSequentially();
  startFireworksIdleLoop();
  fireworksInitialized = true;
};

loadBuildingTilesets();

const highlightState = {
  feature: undefined,
  originalColor: new Cesium.Color(),
};
const highlightColor = Cesium.Color.fromCssColorString("#f5e642");
const screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
const resetCameraButton = document.getElementById("resetCameraButton");

function setResetCameraButtonVisible(isVisible) {
  if (!resetCameraButton) {
    return;
  }
  resetCameraButton.style.display = isVisible ? "flex" : "none";
}

setResetCameraButtonVisible(false);
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
  ".firework-color-swatch"
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
    if (firework.keepOriginalColor) {
      return;
    }
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

const resolveCategoryKeyFromValue = (value) => {
  const entry = Object.entries(fireWorkCategory).find(
    ([, label]) => label === value
  );
  return entry?.[0];
};

const fireworkCategoryCards = Array.from(
  document.querySelectorAll(".firework-type-card")
).filter((card) => fireWorkCategory[card.dataset.fireworkType]);
let activeFireworkCategoryKey = resolveCategoryKeyFromValue(params.category);

const setActiveFireworkTypeCard = (categoryKey) => {
  fireworkCategoryCards.forEach((card) => {
    const key = card.dataset.fireworkType;
    card.classList.toggle("is-active", key === categoryKey);
  });
};

const setActiveFireworkCategory = (categoryKey) => {
  const categoryLabel = fireWorkCategory[categoryKey];
  if (!categoryLabel) {
    return;
  }
  if (categoryKey === activeFireworkCategoryKey) {
    setActiveFireworkTypeCard(categoryKey);
    return;
  }
  activeFireworkCategoryKey = categoryKey;
  params.category = categoryLabel;
  setActiveFireworkTypeCard(categoryKey);
};

if (fireworkCategoryCards.length > 0) {
  fireworkCategoryCards.forEach((card) => {
    card.addEventListener("click", () => {
      const typeKey = card.dataset.fireworkType;
      if (!typeKey || typeKey === activeFireworkCategoryKey) {
        return;
      }
      setActiveFireworkCategory(typeKey);
    });
  });
  setActiveFireworkTypeCard(activeFireworkCategoryKey);
}

const timelineSelections = [];
const timelineSelectedFireworks = [];
let activeTimelineSelectionIndex;
let deleteFireworkButton;
const updateDeleteButtonVisibility = () => {
  if (!deleteFireworkButton) {
    return;
  }
  deleteFireworkButton.style.display = Number.isFinite(
    activeTimelineSelectionIndex
  )
    ? ""
    : "none";
};

const defaultModeTab = document.querySelector(".panel-tab.is-active");
let activeMode = defaultModeTab?.dataset.mode ?? "solo";
const modeTabs = document.querySelectorAll(".panel-tab");
const burstTypeSection = document.querySelector('[data-section="burst-type"]');
const burstTypeCards = Array.from(
  document.querySelectorAll(
    '.firework-type-card[data-firework-type="sokuhatsu"], .firework-type-card[data-firework-type="renpatsu"]'
  )
);
let activeBurstTypeKey =
  burstTypeCards.find((card) => card.classList.contains("is-active"))?.dataset
    .fireworkType || "renpatsu";
const isBurstTypeEnabled = () => activeMode === "burst";
const setActiveBurstTypeCard = (typeKey) => {
  burstTypeCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.fireworkType === typeKey);
  });
};
const updateBurstTypeAvailability = () => {
  const enabled = isBurstTypeEnabled();
  burstTypeCards.forEach((card) => {
    card.classList.toggle("is-disabled", !enabled);
    card.setAttribute("aria-disabled", String(!enabled));
  });
  if (burstTypeSection) {
    burstTypeSection.classList.toggle("is-hidden", !enabled);
    burstTypeSection.setAttribute("aria-hidden", String(!enabled));
  }
  if (enabled) {
    setActiveBurstTypeCard(activeBurstTypeKey);
  }
};
if (burstTypeCards.length > 0) {
  burstTypeCards.forEach((card) => {
    card.addEventListener("click", () => {
      if (!isBurstTypeEnabled()) {
        return;
      }
      const typeKey = card.dataset.fireworkType;
      if (!typeKey || typeKey === activeBurstTypeKey) {
        return;
      }
      activeBurstTypeKey = typeKey;
      setActiveBurstTypeCard(typeKey);
    });
  });
}
updateBurstTypeAvailability();
const setActiveMode = (mode) => {
  if (!mode) {
    return;
  }
  activeMode = mode;
  modeTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.mode === mode);
  });
  updateBurstTypeAvailability();
};
const timelinePanel = document.querySelector(".timeline-panel");
const timelineCarousel = document.getElementById("timelineCarousel");
const timelineClearButton = document.getElementById("timelineClearButton");
const updateTimelineClearButtonVisibility = () => {
  if (!timelineClearButton) {
    return;
  }
  timelineClearButton.style.display =
    timelineSelections.length > 0 ? "" : "none";
};
const updateTimelinePanelVisibility = () => {
  if (!timelinePanel) {
    return;
  }
  timelinePanel.style.display = timelineSelections.length === 0 ? "none" : "";
  updateTimelineClearButtonVisibility();
};
updateTimelinePanelVisibility();
let timelineCards = timelineCarousel
  ? Array.from(timelineCarousel.querySelectorAll(".timeline-card"))
  : [];
const getTimelineCardWrapper = (card) => {
  const parent = card?.parentElement;
  if (parent?.classList.contains("timeline-card-wrapper")) {
    return parent;
  }
  return undefined;
};

const setTimelineCardWrapperProgress = (card, progress = 0) => {
  const wrapper = getTimelineCardWrapper(card);
  if (!wrapper) {
    return;
  }
  const clamped = Math.max(0, Math.min(100, progress));
  wrapper.style.setProperty("--progress", String(clamped));
  wrapper.classList.toggle("is-progressing", clamped > 0);
};

const resetTimelineCardWrapperProgress = (card) => {
  setTimelineCardWrapperProgress(card, 0);
};

const applySelectionToSidebar = (selection) => {
  if (!selection) {
    return;
  }
  if (selection.mode) {
    setActiveMode(selection.mode);
  }
  if (selection.burstType) {
    activeBurstTypeKey = selection.burstType;
    setActiveBurstTypeCard(activeBurstTypeKey);
  }
  if (selection.fireworkType) {
    setActiveFireworkCategory(selection.fireworkType);
  }
  const colorKeyOrHex =
    selection.fireworkColorKey ?? selection.fireworkColor ?? undefined;
  if (colorKeyOrHex) {
    updateFireworkColors(colorKeyOrHex);
  }
  if (Number.isFinite(selection.launchHeight)) {
    if (heightSlider) {
      heightSlider.value = String(selection.launchHeight);
    }
    syncHeightValue(selection.launchHeight);
  }
};
const setActiveTimelineCard = (targetCard) => {
  timelineCards.forEach((card) => {
    card.classList.toggle("is-active", card === targetCard);
  });
  activeTimelineSelectionIndex = undefined;
  if (targetCard?.dataset.selectionIndex) {
    const selectionIndex = Number(targetCard.dataset.selectionIndex);
    const selection = timelineSelections[selectionIndex];
    if (Number.isFinite(selectionIndex)) {
      activeTimelineSelectionIndex = selectionIndex;
    }
    applySelectionToSidebar(selection);
  }
  updateDeleteButtonVisibility();
  updateAddFireworkButtonLabel();
  updateTimelineClearButtonVisibility();
};
const ensureTimelineCardEditIcon = (card) => {
  if (!card) {
    return undefined;
  }
  const existing = card.querySelector(".timeline-card__edit");
  if (existing) {
    return existing;
  }
  const editIcon = document.createElement("span");
  editIcon.className = "material-icons-outlined timeline-card__edit";
  editIcon.textContent = "edit";
  card.appendChild(editIcon);
  return editIcon;
};
const handleTimelineCardClick = (card) => {
  setActiveTimelineCard(card);
  const typeKey = card.dataset.fireworkType;
  const colorKey = card.dataset.fireworkColor;
  const launchHeight = card.dataset.launchHeight;
  let shouldRestart = false;
  if (typeKey && typeKey !== activeFireworkCategoryKey) {
    setActiveFireworkCategory(typeKey, { autoStart: false });
    shouldRestart = true;
  }
  if (colorKey && colorKey !== activeFireworkColorKey) {
    updateFireworkColors(colorKey);
  }
  if (typeof launchHeight === "string" && launchHeight.length > 0) {
    const numericHeight = Number(launchHeight);
    if (Number.isFinite(numericHeight)) {
      if (heightSlider) {
        heightSlider.value = String(numericHeight);
      }
      syncHeightValue(numericHeight);
    }
  }
};
const registerTimelineCard = (card) => {
  if (!card) {
    return;
  }
  resetTimelineCardWrapperProgress(card);
  const editIcon = ensureTimelineCardEditIcon(card);
  if (editIcon) {
    editIcon.addEventListener("click", (event) => {
      event.stopPropagation();
      handleTimelineCardClick(card);
    });
  }
  card.addEventListener("click", () => handleTimelineCardClick(card));
};
const removeTimelineCardElement = (card) => {
  if (!card) {
    return;
  }
  const parent = card.parentElement;
  if (parent?.classList.contains("timeline-card-wrapper")) {
    parent.remove();
    return;
  }
  card.remove();
};
const addTimelineCard = ({
  fireworkType,
  fireworkColor,
  launchHeight,
  fireworkColorKey,
  mode,
  burstType,
  selectionIndex,
}) => {
  if (!timelineCarousel) {
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "timeline-card-wrapper";
  const card = document.createElement("div");
  card.className = "timeline-card";
  card.dataset.fireworkType = fireworkType;
  card.dataset.fireworkColor = fireworkColorKey;
  card.dataset.launchHeight = String(launchHeight);
  if (mode) {
    card.dataset.mode = mode;
  }
  if (burstType) {
    card.dataset.burstType = burstType;
  }
  if (Number.isFinite(selectionIndex)) {
    card.dataset.selectionIndex = String(selectionIndex);
  }
  const title = document.createElement("span");
  title.className = "timeline-card__title";
  const meta = document.createElement("span");
  meta.className = "timeline-card__meta";
  const colorLabel = fireworkColorPresets[fireworkColorKey]
    ? fireworkColorKey
    : fireworkColor?.toUpperCase() || "CUSTOM";
  const colorIndicator = document.createElement("span");
  colorIndicator.className = "timeline-card__color";
  colorIndicator.style.backgroundColor =
    fireworkColor || fireworkColorPresets[fireworkColorKey]?.hex || "#fff";
  const modeLabel =
    (mode && timelineModeLabels[mode]) || timelineModeLabels.solo;
  const modeIcon = (mode && timelineModeIcons[mode]) || timelineModeIcons.solo;
  colorIndicator.title = modeLabel;
  colorIndicator.setAttribute("role", "img");
  colorIndicator.setAttribute("aria-label", `${modeLabel} / ${colorLabel}`);
  const colorIndicatorIcon = document.createElement("span");
  colorIndicatorIcon.className =
    "material-icons-outlined timeline-card__color-icon";
  colorIndicatorIcon.textContent = modeIcon;
  colorIndicator.appendChild(colorIndicatorIcon);
  card.append(colorIndicator, title, meta);
  wrapper.appendChild(card);
  resetTimelineCardWrapperProgress(card);
  timelineCarousel.appendChild(wrapper);
  timelineCards.push(card);
  registerTimelineCard(card);
};

const updateTimelineCard = (card, selection, selectionIndex) => {
  if (!card || !selection) {
    return;
  }
  card.dataset.fireworkType = selection.fireworkType;
  card.dataset.fireworkColor = selection.fireworkColorKey;
  card.dataset.launchHeight = String(selection.launchHeight);
  if (selection.mode) {
    card.dataset.mode = selection.mode;
  }
  if (selection.burstType) {
    card.dataset.burstType = selection.burstType;
  } else {
    delete card.dataset.burstType;
  }
  if (Number.isFinite(selectionIndex)) {
    card.dataset.selectionIndex = String(selectionIndex);
  }
  const colorIndicator = card.querySelector(".timeline-card__color");
  if (colorIndicator) {
    colorIndicator.style.backgroundColor =
      selection.fireworkColor ||
      fireworkColorPresets[selection.fireworkColorKey]?.hex ||
      "#fff";
    const modeLabel =
      (selection.mode && timelineModeLabels[selection.mode]) ||
      timelineModeLabels.solo;
    const colorLabel = fireworkColorPresets[selection.fireworkColorKey]
      ? selection.fireworkColorKey
      : selection.fireworkColor?.toUpperCase() || "CUSTOM";
    colorIndicator.title = modeLabel;
    colorIndicator.setAttribute("aria-label", `${modeLabel} / ${colorLabel}`);
    const icon = colorIndicator.querySelector(".timeline-card__color-icon");
    if (icon) {
      icon.textContent =
        (selection.mode && timelineModeIcons[selection.mode]) ||
        timelineModeIcons.solo;
    }
  }
};

if (timelineCards.length > 0) {
  timelineCards.forEach(registerTimelineCard);
}

const timelinePlayButton = document.querySelector(".timeline-play");
let timelineProgressAnimationId;
let isTimelineProgressPlaying = false;
let isTimelineSequenceActive = false;
let timelineSequenceTimeoutId;
let isTimelineLooping = false;
const activeTimelineBurstStops = new Set();
let activeTimelineProgressCardIndex;

const resetAllTimelineCardProgress = () => {
  activeTimelineProgressCardIndex = undefined;
  timelineCards.forEach((card) => resetTimelineCardWrapperProgress(card));
};

const updateTimelineCardProgress = (value, { min = 0, span = 1 } = {}) => {
  if (timelineCards.length === 0) {
    return;
  }
  const normalized = Math.max(0, Math.min(1, (value - min) / span));
  const totalCards = timelineCards.length;
  const slotSize = 1 / totalCards;
  const targetIndex = Math.min(
    totalCards - 1,
    Math.floor(normalized * totalCards)
  );
  if (!Number.isFinite(targetIndex) || targetIndex < 0) {
    return;
  }
  const slotStart = slotSize * targetIndex;
  const slotProgress = Math.max(
    0,
    Math.min(1, (normalized - slotStart) / slotSize)
  );

  if (activeTimelineProgressCardIndex !== targetIndex) {
    if (Number.isFinite(activeTimelineProgressCardIndex)) {
      resetTimelineCardWrapperProgress(
        timelineCards[activeTimelineProgressCardIndex]
      );
    }
    activeTimelineProgressCardIndex = targetIndex;
    resetTimelineCardWrapperProgress(timelineCards[targetIndex]);
  }

  setTimelineCardWrapperProgress(
    timelineCards[targetIndex],
    slotProgress * 100
  );
};

const stopTimelinePlaybackSequence = ({ keepLooping = false } = {}) => {
  if (timelineSequenceTimeoutId) {
    window.clearTimeout(timelineSequenceTimeoutId);
    timelineSequenceTimeoutId = undefined;
  }
  activeTimelineBurstStops.forEach((stop) => {
    try {
      stop();
    } catch (error) {
      console.error("Failed to stop burst sequence:", error);
    }
  });
  activeTimelineBurstStops.clear();
  isTimelineSequenceActive = false;
  if (!keepLooping) {
    isTimelineLooping = false;
  }
};

const triggerTimelineSelection = (selection) => {
  const matrix = selection.matrix;
  if (
    selection.fireworkType == "botan" ||
    selection.fireworkColor == "meshibe"
  ) {
    const innerRadius = selection.radius * 0.6;
    const outerRadius = selection.radius * 1.2;
    const primaryColorHex = selection.fireworkColor;
    const secondaryColorHex = selection.secondary;

    const innerFirework = fireworkManager.createFirework({
      ...selection,
      radius: innerRadius,
      fireworkColor: primaryColorHex,
      matrix: matrix,
    });
    resetFireworkAudioState(innerFirework);
    timelineSelectedFireworks.push(innerFirework);

    const outerFirework = fireworkManager.createFirework({
      ...selection,
      radius: outerRadius,
      fireworkColor: secondaryColorHex,
      matrix: matrix,
    });
    resetFireworkAudioState(outerFirework);
    timelineSelectedFireworks.push(outerFirework);
  } else if (selection.fireworkType == "heart") {
    const heartFirework = fireworkManager.createFirework({
      ...selection,
      modelPositions: heartModelPositions,
      matrix: matrix,
    });
    resetFireworkAudioState(heartFirework);
    timelineSelectedFireworks.push(heartFirework);
  } else if (selection.fireworkType == "love") {
    const loveFirework = fireworkManager.createFirework({
      ...selection,
      modelPositions: loveModelPositions,
      matrix: matrix,
    });
    resetFireworkAudioState(loveFirework);
    timelineSelectedFireworks.push(loveFirework);
  } else {
    const firework = fireworkManager.createFirework({
      ...selection,
      matrix: matrix,
    });
    resetFireworkAudioState(firework);
    timelineSelectedFireworks.push(firework);
  }
};

const playTimelineSelectionsSequentially = (
  selections = timelineSelections,
  { durationMs = timelinePlaybackDurationMs, onComplete } = {}
) => {
  if (selections.length === 0) {
    return;
  }

  stopTimelinePlaybackSequence({ keepLooping: isTimelineLooping });
  isTimelineSequenceActive = true;
  const delayMs = durationMs / Math.max(selections.length, 1);

  const step = (index) => {
    if (!isTimelineSequenceActive) {
      return;
    }
    const selection = selections[index];
    if (!selection) {
      return;
    }

    const count = selection.mode === "burst" ? 5 : 1;

    const isSokuhatsu = selection.burstType === "sokuhatsu";
    const sokuhatsuDelayMs = 200;
    const launchSingle = () => {
      if (!isTimelineSequenceActive) {
        return;
      }
      const fireworkMatrix = fireworkManager.createRandomizedLaunchMatrix();
      selection.matrix = fireworkMatrix;
      triggerTimelineSelection(selection);
    };

    if (selection.mode === "burst" && isSokuhatsu) {
      const timeouts = new Set();
      const stop = () => {
        timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        timeouts.clear();
      };
      activeTimelineBurstStops.add(stop);
      for (let i = 0; i < count; i++) {
        const timeoutId = window.setTimeout(() => {
          launchSingle();
          if (i === count - 1) {
            activeTimelineBurstStops.delete(stop);
          }
        }, i * sokuhatsuDelayMs);
        timeouts.add(timeoutId);
      }
    } else {
      // Keep simultaneous launches for renpatsu and non-burst modes
      for (let i = 0; i < count; i++) {
        launchSingle();
      }
    }

    if (index + 1 >= selections.length) {
      isTimelineSequenceActive = false;
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    timelineSequenceTimeoutId = window.setTimeout(
      () => step(index + 1),
      delayMs
    );
  };

  step(0);
};

const setTimelinePlayButtonState = (isPlaying) => {
  if (!timelinePlayButton) {
    return;
  }
  const iconName = isPlaying ? "stop" : "play_arrow";
  timelinePlayButton.innerHTML = `<span class="material-icons">${iconName}</span>`;
  timelinePlayButton.setAttribute("aria-label", isPlaying ? "停止" : "再生");
  timelinePlayButton.classList.toggle("is-playing", isPlaying);
};

const stopTimelineProgressAnimation = ({
  reset = false,
  stopSequence = true,
  keepLooping = false,
} = {}) => {
  if (timelineProgressAnimationId) {
    cancelAnimationFrame(timelineProgressAnimationId);
    timelineProgressAnimationId = undefined;
  }
  if (stopSequence) {
    stopTimelinePlaybackSequence({ keepLooping });
  } else if (!keepLooping) {
    isTimelineLooping = false;
  }
  if (reset) {
    resetAllTimelineCardProgress();
  }
  isTimelineProgressPlaying = false;
  setTimelinePlayButtonState(false);
  if (!isTimelineLooping) {
    startFireworksIdleLoop();
    setFireworksVisibility(true);
  }
};

const startTimelineProgressAnimation = ({ loop = false, onLoop } = {}) => {
  stopFireworksIdleLoop();
  setFireworksVisibility(false);
  resetAllTimelineCardProgress();
  stopTimelineProgressAnimation({ stopSequence: false, keepLooping: loop });
  isTimelineLooping = loop;
  let animationStart = performance.now();
  isTimelineProgressPlaying = true;
  setTimelinePlayButtonState(true);

  const animate = (now) => {
    const elapsed = now - animationStart;
    const ratio = Math.min(elapsed / timelinePlaybackDurationMs, 1);
    updateTimelineCardProgress(ratio, { min: 0, span: 1 });
    if (ratio < 1) {
      timelineProgressAnimationId = requestAnimationFrame(animate);
      return;
    }
    if (loop && isTimelineProgressPlaying) {
      if (typeof onLoop === "function") {
        onLoop();
      }
      animationStart = now;
      timelineProgressAnimationId = requestAnimationFrame(animate);
      return;
    }
    stopTimelineProgressAnimation();
  };

  timelineProgressAnimationId = requestAnimationFrame(animate);
};

timelinePlayButton.addEventListener("click", () => {
  if (isRandomFireworkOnLaunch) isRandomFireworkOnLaunch = false;
  if (isTimelineProgressPlaying) {
    fireworkManager.pauseAnimation();
    stopTimelineProgressAnimation();
    return;
  }

  fireworkManager.resumeAnimation();

  if (timelineSelections.length === 0) {
    return;
  }

  const restartTimelineSequence = () => {
    if (!isTimelineLooping) {
      return;
    }
    stopTimelinePlaybackSequence({ keepLooping: true });
    playTimelineSelectionsSequentially(timelineSelections);
  };

  isTimelineLooping = true;
  stopTimelinePlaybackSequence({ keepLooping: true });
  restartTimelineSequence();

  startTimelineProgressAnimation({
    loop: true,
    onLoop: restartTimelineSequence,
  });
});

const heightSlider = document.getElementById("heightSlider");
const heightValue = document.getElementById("heightValue");
const syncHeightValue = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }
  params.height = numericValue;
  if (heightValue) {
    heightValue.textContent = String(numericValue);
  }
  fireworks.forEach((firework) => {
    if (firework.appearance?.uniforms) {
      firework.appearance.uniforms.u_launchHeight = numericValue;
    }
  });
};
if (heightSlider) {
  heightSlider.value = String(params.height);
  syncHeightValue(params.height);
  heightSlider.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    syncHeightValue(target.value);
  });
}

const addFireworkButton = document.getElementById("addFireworkButton");
const updateAddFireworkButtonState = () => {
  if (!addFireworkButton) {
    return;
  }
  addFireworkButton.disabled =
    timelineSelections.length >= maxTimelineSelections;
};
const updateAddFireworkButtonLabel = () => {
  if (!addFireworkButton) {
    return;
  }
  addFireworkButton.textContent = Number.isFinite(activeTimelineSelectionIndex)
    ? "この設定で保存"
    : "+ この設定で花火を追加";
};
if (addFireworkButton) {
  deleteFireworkButton = document.createElement("button");
  deleteFireworkButton.id = "deleteFireworkButton";
  deleteFireworkButton.type = "button";
  deleteFireworkButton.className = "panel-cta panel-cta--danger";
  deleteFireworkButton.innerHTML =
    '<span class="material-icons-outlined" aria-hidden="true">delete</span><span>この設定を削除</span>';
  deleteFireworkButton.style.display = "none";
  addFireworkButton.insertAdjacentElement("afterend", deleteFireworkButton);
  updateDeleteButtonVisibility();
  updateAddFireworkButtonLabel();
}

addFireworkButton.addEventListener("click", () => {
  if (
    activeTimelineSelectionIndex === undefined &&
    timelineSelections.length >= maxTimelineSelections
  ) {
    return;
  }

  const fireworkColorHex =
    resolveFireworkHex(activeFireworkColorKey) ?? params.fireworkColor;
  const secondaryColorHex = resolveSecondaryPresetKey(activeFireworkColorKey);
  const launchHeight = Number(heightSlider?.value);

  const isRenpatsu =
    activeMode === "burst" && activeBurstTypeKey === "renpatsu";

  const selection = {
    numberOfParticles: category[activeFireworkCategoryKey].numberOfParticles,
    pointSize: category[activeFireworkCategoryKey].pointSize,
    radius: category[activeFireworkCategoryKey].radius,
    bloomDuration: category[activeFireworkCategoryKey].bloomDuration,
    fireworkType: activeFireworkCategoryKey,
    fireworkColor: fireworkColorHex,
    fireworkColorKey: activeFireworkColorKey,
    secondary:
      activeFireworkCategoryKey === "botan" ||
      activeFireworkCategoryKey === "meshibe"
        ? secondaryColorHex
        : undefined,
    launchHeight: launchHeight,
    times: category[activeFireworkCategoryKey].times,
    gravityStrength: category[activeFireworkCategoryKey].gravityStrength,
    mode: activeMode,
    burstType: isBurstTypeEnabled() ? activeBurstTypeKey : undefined,
  };
  // 編集モード中は既存の選択を上書き
  if (Number.isFinite(activeTimelineSelectionIndex)) {
    timelineSelections[activeTimelineSelectionIndex] = selection;
    const targetCard = timelineCards.find(
      (card) =>
        Number(card.dataset.selectionIndex) === activeTimelineSelectionIndex
    );
    updateTimelineCard(targetCard, selection, activeTimelineSelectionIndex);
    setActiveTimelineCard(targetCard);
  } else {
    timelineSelections.push(selection);
    addTimelineCard({
      ...selection,
      selectionIndex: timelineSelections.length - 1,
    });
    updateTimelinePanelVisibility();
  }

  updateAddFireworkButtonState();
  updateDeleteButtonVisibility();
  updateAddFireworkButtonLabel();
  updateTimelineClearButtonVisibility();
});

const reindexTimelineCards = () => {
  timelineCards.forEach((card, index) => {
    card.dataset.selectionIndex = String(index);
  });
};

if (deleteFireworkButton) {
  deleteFireworkButton.addEventListener("click", () => {
    if (!Number.isFinite(activeTimelineSelectionIndex)) {
      return;
    }
    const deleteIndex = activeTimelineSelectionIndex;
    timelineSelections.splice(deleteIndex, 1);
    const targetCard = timelineCards.find(
      (card) => Number(card.dataset.selectionIndex) === deleteIndex
    );
    if (targetCard) {
      removeTimelineCardElement(targetCard);
    }
    timelineCards = timelineCards.filter(
      (card) => Number(card.dataset.selectionIndex) !== deleteIndex
    );
    reindexTimelineCards();
    activeTimelineSelectionIndex = undefined;
    updateTimelinePanelVisibility();
    updateAddFireworkButtonState();
    updateDeleteButtonVisibility();
    updateAddFireworkButtonLabel();
    updateTimelineClearButtonVisibility();
  });
}

const clearTimelineFireworkPrimitives = () => {
  timelineSelectedFireworks.forEach((firework) => {
    if (firework?.primitive && !firework.primitive.isDestroyed?.()) {
      scene.primitives.remove(firework.primitive);
    }
  });
  timelineSelectedFireworks.length = 0;
};

const clearTimelineData = () => {
  stopTimelineProgressAnimation({ reset: true });
  stopTimelinePlaybackSequence();
  clearTimelineFireworkPrimitives();
  resetAllTimelineCardProgress();
  timelineSelections.length = 0;
  timelineCards.forEach((card) => removeTimelineCardElement(card));
  timelineCards = [];
  if (timelineCarousel) {
    timelineCarousel.innerHTML = "";
  }
  activeTimelineSelectionIndex = undefined;
  updateTimelinePanelVisibility();
  updateAddFireworkButtonState();
  updateDeleteButtonVisibility();
  updateAddFireworkButtonLabel();
  updateTimelineClearButtonVisibility();
};

if (timelineClearButton) {
  timelineClearButton.addEventListener("click", clearTimelineData);
}

if (modeTabs.length > 0) {
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.mode) {
        setActiveMode(tab.dataset.mode);
      }
    });
  });
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

function animate() {
  fireworkManager.animate(fireworks, undefined, handleFireworkAudio);
  // fireworkManager.animate(
  //   timelineSelectedFireworks,
  //   undefined,
  //   handleFireworkAudio
  // );
}

if (isRandomFireworkOnLaunch) {
  animate();
}

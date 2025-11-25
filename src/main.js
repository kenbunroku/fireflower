import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { Pane } from "tweakpane";

import FireworkManager from "./FireworkManager";
import { rotatePositionsAroundX } from "./util.js";

Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYTE4NjhhMy01YjM0LTQ0MDYtOThjMi1hNWJlYmI5MWY3YzQiLCJpZCI6MzQ2NzMzLCJpYXQiOjE3NTk0NTA4NDN9.IQ-97lJJ-qTrkTUllzEMiMAIgCVSEb9eQxwIbSJ_zjo";

const isDebugMode = true;

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./static/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let heartModelPositions = new Float32Array();
let loveModelPositions = new Float32Array();

gltfLoader.load("./heart.glb", (gltf) => {
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
  if (basePositions) {
    heartModelPositions = rotatePositionsAroundX(basePositions, Math.PI / 2);
    category.heart.numberOfParticles = heartModelPositions.length / 3;
  }
});

gltfLoader.load("./merryme.glb", (gltf) => {
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
  if (basePositions) {
    loveModelPositions = rotatePositionsAroundX(basePositions, Math.PI / 2);
    category.love.numberOfParticles = loveModelPositions.length / 3;
  }
});

const fireWorkCategory = {
  kiku: "菊",
  botan: "牡丹",
  meshibe: "めしべ",
  poka: "ポカ物",
  kanmukiku: "冠菊",
  heart: "ハート",
  love: "告白",
};

const params = {
  category: fireWorkCategory.kiku,
  numberOfParticles: 400,
  pointSize: 4.0,
  radius: 800,
  fireworkColor: "#ffd256",
  launchDuration: 2.0,
  bloomDuration: 2.0,
  fireworkDuration: 2.0,
  times: 30,
  gravityStrength: 1,
  buildingColor: "#5fd4ff",
  buildingOpacity: 0.7,
  launchOffsetRangeMeters: 100.0,
  height: 200,
  delay: 0.005,
  interval: 1.0,
};

const category = {
  kiku: {
    numberOfParticles: 400,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 2,
    times: 30,
    gravityStrength: 1,
  },
  botan: {
    numberOfParticles: 400,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 2,
    times: 10,
    gravityStrength: 1,
  },
  meshibe: {
    numberOfParticles: 400,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 3,
    times: 100,
    gravityStrength: 1,
  },
  kanmukiku: {
    numberOfParticles: 400,
    pointSize: 4.0,
    radius: 800,
    bloomDuration: 3,
    times: 100,
    gravityStrength: 1,
  },
  poka: {
    numberOfParticles: 400,
    pointSize: 4.0,
    radius: 200,
    bloomDuration: 3,
    times: 100,
    gravityStrength: 4,
  },
  heart: {
    numberOfParticles: 0,
    pointSize: 4.0,
    radius: 50,
    bloomDuration: 2,
    times: 1,
    gravityStrength: 1,
  },
  love: {
    numberOfParticles: 0,
    pointSize: 4.0,
    radius: 50,
    bloomDuration: 2,
    times: 1,
    gravityStrength: 1,
  },
};

const fireworkColorPresets = {
  hotPink: { hex: "#ff4181", secondary: "#fdc322" },
  yellow: { hex: "#fdc322", secondary: "#4483f9" },
  pink: { hex: "#ffa6ea", secondary: "#ecf1ff" },
  purple: { hex: "#8775ff", secondary: "#4effc1" },
  orange: { hex: "#ff8c4e", secondary: "#9788ff" },
  red: { hex: "#e00100", secondary: "#ffe0af" },
  green: { hex: "#00de0b", secondary: "#ff7bdf" },
  cream: { hex: "#ffe0af", secondary: "#ff6c1d" },
  white: { hex: "#ecf1ff", secondary: "#5bcf21" },
};
const defaultFireworkColorKey = "hotPink";

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

const setup = () => {
  setupPlateauAssets();
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
scene.debugShowFramesPerSecond = false;
scene.highDynamicRange = true;

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
const fireworkManager = new FireworkManager({
  scene,
  params,
  fireWorkCategory,
  modelMatrix,
  modelPositions: heartModelPositions,
});
const fireworks = [];

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

createRandomFireworks(5);

const scheduleFireworksSequentially = () => {
  const spacingMs = Math.max(params.interval * 1000, 0);
  fireworks.forEach((firework, index) => {
    firework.startDelayMs = index * spacingMs;
    firework.startTime = undefined;
  });
};

scheduleFireworksSequentially();

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

const maxTimelineSelections = 9;
const timelineModeIcons = {
  solo: "bolt",
  burst: "auto_awesome",
};
const timelineModeLabels = {
  solo: "単発",
  burst: "連発",
};
const defaultModeTab = document.querySelector(".panel-tab.is-active");
let activeMode = defaultModeTab?.dataset.mode ?? "solo";
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
const timelinePanel = document.querySelector(".timeline-panel");
const timelineCarousel = document.getElementById("timelineCarousel");
const updateTimelinePanelVisibility = () => {
  if (!timelinePanel) {
    return;
  }
  timelinePanel.style.display = timelineSelections.length === 0 ? "none" : "";
};
updateTimelinePanelVisibility();
let timelineCards = timelineCarousel
  ? Array.from(timelineCarousel.querySelectorAll(".timeline-card"))
  : [];
const setActiveTimelineCard = (targetCard) => {
  timelineCards.forEach((card) => {
    card.classList.toggle("is-active", card === targetCard);
  });
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
  card.addEventListener("click", () => handleTimelineCardClick(card));
};
const addTimelineCard = ({
  fireworkType,
  fireworkColor,
  launchHeight,
  fireworkColorKey,
  mode,
}) => {
  if (!timelineCarousel) {
    return;
  }
  const card = document.createElement("div");
  card.className = "timeline-card";
  card.dataset.fireworkType = fireworkType;
  card.dataset.fireworkColor = fireworkColorKey;
  card.dataset.launchHeight = String(launchHeight);
  if (mode) {
    card.dataset.mode = mode;
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
  timelineCarousel.appendChild(card);
  timelineCards.push(card);
  registerTimelineCard(card);
  setActiveTimelineCard(card);
};

if (timelineCards.length > 0) {
  timelineCards.forEach(registerTimelineCard);
}

const timelineProgressContainer = document.querySelector(".timeline-progress");
const timelineProgressInput = timelineProgressContainer?.querySelector(
  'input[type="range"]'
);
const timelinePlayButton = document.querySelector(".timeline-play");
const timelinePlaybackDurationMs = 10000;
let timelineProgressAnimationId;
let isTimelineProgressPlaying = false;
let isTimelineSequenceActive = false;
let timelineSequenceTimeoutId;
const activeTimelineBurstStops = new Set();

const stopTimelinePlaybackSequence = () => {
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

    timelineSelectedFireworks.push(
      fireworkManager.createFirework({
        ...selection,
        radius: innerRadius,
        fireworkColor: primaryColorHex,
        matrix: matrix,
      })
    );

    timelineSelectedFireworks.push(
      fireworkManager.createFirework({
        ...selection,
        radius: outerRadius,
        fireworkColor: secondaryColorHex,
        matrix: matrix,
      })
    );
  } else if (selection.fireworkType == "heart") {
    timelineSelectedFireworks.push(
      fireworkManager.createFirework({
        ...selection,
        modelPositions: heartModelPositions,
        matrix: matrix,
      })
    );
  } else if (selection.fireworkType == "love") {
    timelineSelectedFireworks.push(
      fireworkManager.createFirework({
        ...selection,
        modelPositions: loveModelPositions,
        matrix: matrix,
      })
    );
  } else {
    timelineSelectedFireworks.push(
      fireworkManager.createFirework({ ...selection, matrix: matrix })
    );
  }
};

const playTimelineSelectionsSequentially = () => {
  if (timelineSelections.length === 0) {
    return;
  }

  stopTimelinePlaybackSequence();
  isTimelineSequenceActive = true;
  const delayMs =
    timelinePlaybackDurationMs / Math.max(timelineSelections.length, 1);

  const step = (index) => {
    if (!isTimelineSequenceActive) {
      return;
    }
    const selection = timelineSelections[index];
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

    if (index + 1 >= timelineSelections.length) {
      isTimelineSequenceActive = false;
      return;
    }

    timelineSequenceTimeoutId = window.setTimeout(
      () => step(index + 1),
      delayMs
    );
  };

  step(0);
};

const parseRangeValue = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getTimelineProgressBounds = (input) => {
  const min = parseRangeValue(input.min, 0);
  const max = parseRangeValue(input.max, 100);
  const span = Math.max(max - min, 1);
  return { min, max, span };
};

const resetTimelineProgress = () => {
  if (!timelineProgressInput) {
    return;
  }
  const { min } = getTimelineProgressBounds(timelineProgressInput);
  timelineProgressInput.value = String(min);
  timelineProgressInput.style.removeProperty("background");
};

const paintTimelineProgressTrack = (value) => {
  if (!timelineProgressInput) {
    return;
  }
  const { min, span } = getTimelineProgressBounds(timelineProgressInput);
  const percent = ((value - min) / span) * 100;
  if (percent <= 0) {
    timelineProgressInput.style.removeProperty("background");
    return;
  }
  const clampedPercent = Math.max(0, Math.min(100, percent));
  timelineProgressInput.style.background = `linear-gradient(90deg, #ffffff 0%, #ffffff ${clampedPercent}%, rgba(255, 255, 255, 0.15) ${clampedPercent}%, rgba(255, 255, 255, 0.15) 100%)`;
};

const setTimelinePlayButtonState = (isPlaying) => {
  if (!timelinePlayButton) {
    return;
  }
  const iconName = isPlaying ? "stop" : "play_arrow";
  timelinePlayButton.innerHTML = `<span class="material-icons">${iconName}</span>`;
  timelinePlayButton.setAttribute("aria-label", isPlaying ? "停止" : "再生");
};

const stopTimelineProgressAnimation = ({ reset = false } = {}) => {
  if (timelineProgressAnimationId) {
    cancelAnimationFrame(timelineProgressAnimationId);
    timelineProgressAnimationId = undefined;
  }
  stopTimelinePlaybackSequence();
  if (reset) {
    resetTimelineProgress();
  }
  isTimelineProgressPlaying = false;
  setTimelinePlayButtonState(false);
};

const startTimelineProgressAnimation = () => {
  if (!timelineProgressInput) {
    return;
  }
  const { min, max, span } = getTimelineProgressBounds(timelineProgressInput);
  const currentValue = parseRangeValue(timelineProgressInput.value, min);
  let clampedStartValue = Math.max(min, Math.min(max, currentValue));
  if (clampedStartValue >= max) {
    clampedStartValue = min;
    timelineProgressInput.value = String(min);
    timelineProgressInput.style.removeProperty("background");
  }
  const startOffsetMs =
    ((clampedStartValue - min) / span) * timelinePlaybackDurationMs;
  stopTimelineProgressAnimation();
  const animationStart = performance.now() - startOffsetMs;
  isTimelineProgressPlaying = true;
  setTimelinePlayButtonState(true);

  const animate = (now) => {
    const elapsed = now - animationStart;
    const ratio = Math.min(elapsed / timelinePlaybackDurationMs, 1);
    const value = min + ratio * span;
    timelineProgressInput.value = String(value);
    paintTimelineProgressTrack(value);
    if (ratio < 1) {
      timelineProgressAnimationId = requestAnimationFrame(animate);
      return;
    }
    stopTimelineProgressAnimation();
  };

  timelineProgressAnimationId = requestAnimationFrame(animate);
};

timelinePlayButton.addEventListener("click", () => {
  if (isTimelineProgressPlaying) {
    fireworkManager.pauseAnimation();
    stopTimelineProgressAnimation();
    return;
  }

  fireworkManager.resumeAnimation();

  if (timelineSelections.length === 0) {
    return;
  }

  startTimelineProgressAnimation();

  playTimelineSelectionsSequentially();
});

if (timelineProgressInput) {
  timelineProgressInput.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    paintTimelineProgressTrack(Number(target.value));
  });
}

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

addFireworkButton.addEventListener("click", () => {
  if (timelineSelections.length >= maxTimelineSelections) {
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
    fireworkColorKey: activeFireworkCategoryKey,
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
  timelineSelections.push(selection);

  updateTimelinePanelVisibility();
  addTimelineCard(selection);
  updateAddFireworkButtonState();
});

const modeTabs = document.querySelectorAll(".panel-tab");
if (modeTabs.length > 0) {
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      modeTabs.forEach((peer) => peer.classList.remove("is-active"));
      tab.classList.add("is-active");
      if (tab.dataset.mode) {
        activeMode = tab.dataset.mode;
      }
      updateBurstTypeAvailability();
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
  fireworkManager.animate(fireworks);
  fireworkManager.animate(timelineSelectedFireworks);
}

animate();

const createDebugPane = () => {
  const pane = new Pane();
  pane.addBinding(params, "category", {
    options: fireWorkCategory,
  });

  pane
    .addBinding(params, "numberOfParticles", {
      min: 100,
      max: 1000,
      step: 10,
    })
    .on("change", (event) => {
      fireworkManager.createFirework({
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

  pane.addBinding(params, "fireworkDuration", {
    min: 1,
    max: 60,
  });

  pane.addBinding(params, "times", {
    min: 1,
    max: 100,
    step: 1,
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

// if (isDebugMode) createDebugPane();

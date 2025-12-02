/**
 * Viewer Module
 * Cesium Viewerの初期化と基本設定
 */

import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

let viewer = null;
let scene = null;
let bloom = null;

/**
 * Cesium Viewerを初期化
 */
export const initViewer = async (containerId = "cesiumContainer") => {
  const cesiumAccessToken = import.meta.env?.VITE_CESIUM_ACCESS_TOKEN;
  if (!cesiumAccessToken) {
    console.error(
      "Cesium access token is missing. Set VITE_CESIUM_ACCESS_TOKEN in your .env file."
    );
  } else {
    Cesium.Ion.defaultAccessToken = cesiumAccessToken;
  }

  viewer = new Cesium.Viewer(containerId, {
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

  // Mapboxベースレイヤーの設定
  const mapboxAccessToken = import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN;
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.MapboxStyleImageryProvider({
      styleId: "navigation-night-v1",
      accessToken: mapboxAccessToken,
    })
  );

  scene = viewer.scene;
  scene.globe.depthTestAgainstTerrain = true;
  scene.debugShowFramesPerSecond = true;
  scene.highDynamicRange = true;
  scene.globe.enableLighting = true;

  // 夜の雰囲気設定
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(
    "2025-10-24T12:00:00Z"
  );

  return { viewer, scene };
};

/**
 * Bloomエフェクトをセットアップ
 */
export const setupBloom = () => {
  if (!scene || !scene.postProcessStages) {
    console.warn("Cesium scene is not ready for bloom setup.");
    return null;
  }

  if (bloom) {
    return bloom;
  }

  const postProcessStages = scene.postProcessStages;
  bloom =
    postProcessStages.bloom ||
    postProcessStages.add(Cesium.PostProcessStageLibrary.createBloomStage());

  if (!bloom) {
    console.warn("Unable to initialize bloom post process stage.");
    return null;
  }

  bloom.enabled = true;
  bloom.uniforms.glowOnly = false;
  bloom.uniforms.contrast = 128.0;
  bloom.uniforms.brightness = -0.4;
  bloom.uniforms.delta = 0.9;
  bloom.uniforms.sigma = 4.0;
  bloom.uniforms.stepSize = 1.0;

  return bloom;
};

/**
 * フルスクリーンボタンをコントロールパネルに移動
 */
export const moveFullscreenButton = (
  targetContainer,
  insertBeforeElement = null
) => {
  if (!viewer || !targetContainer) {
    return;
  }

  const fullscreenContainer =
    viewer.fullscreenButton?.container ||
    viewer.container.querySelector(".cesium-viewer-fullscreenContainer");

  if (!fullscreenContainer) {
    return;
  }

  fullscreenContainer.classList.add("control-panel__fullscreen");

  if (insertBeforeElement) {
    targetContainer.insertBefore(fullscreenContainer, insertBeforeElement);
  } else {
    targetContainer.appendChild(fullscreenContainer);
  }
};

export const getViewer = () => viewer;
export const getScene = () => scene;

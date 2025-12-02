/**
 * Building Tileset Module
 * 3D Tilesの建物データの読み込みとスタイリング
 */

import * as Cesium from "cesium";

let buildingTilesets = [];
let buildingSilhouetteStage = null;

// スタイリッシュなネオンマゼンタ
const HOVER_COLOR = Cesium.Color.fromCssColorString("#ff1f82").withAlpha(0.95);

// パフォーマンス設定
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

/**
 * タイルセットにパフォーマンス設定を適用
 */
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

/**
 * 建物スタイルを適用
 */
const applyBuildingStyle = (tileset, buildingColor, buildingOpacity) => {
  const clampedOpacity = Math.min(Math.max(buildingOpacity ?? 1, 0), 1);
  const cssColor = Cesium.Color.fromCssColorString(
    buildingColor || "#000000",
    new Cesium.Color()
  );
  cssColor.alpha = clampedOpacity;

  tileset.style = new Cesium.Cesium3DTileStyle({
    // 事前にCSSカラー文字列へ変換しておくことで undefined を避ける
    color: `color('${cssColor.toCssColorString()}')`,
  });
};

/**
 * シルエットエフェクト用に建物を登録
 */
const registerBuildingForSilhouette = (
  tileset,
  scene,
  silhouetteColor,
  silhouetteWidth = 0.002
) => {
  buildingTilesets.push(tileset);

  if (!buildingSilhouetteStage) {
    buildingSilhouetteStage =
      Cesium.PostProcessStageLibrary.createSilhouetteStage();

    const color = Cesium.Color.fromCssColorString(
      silhouetteColor,
      new Cesium.Color()
    );
    color.alpha = 1.0;
    buildingSilhouetteStage.uniforms.color = color;
    buildingSilhouetteStage.uniforms.length = silhouetteWidth;
    scene.postProcessStages.add(buildingSilhouetteStage);
  }

  buildingSilhouetteStage.selected = buildingTilesets;
};

/**
 * 建物タイルセットを読み込む
 */
export const loadBuildingTilesets = async (scene, params, onFirstVisible) => {
  const {
    buildingColor,
    buildingOpacity,
    buildingOutlineColor,
    buildingOutlineWidth,
  } = params;

  const tilesetUrls = [
    // 台東区 LOD2
    "https://assets.cms.plateau.reearth.io/assets/59/0fbb20-59cb-4ce5-9d12-2273ce72e6d2/13106_taito-ku_city_2024_citygml_1_op_bldg_3dtiles_13106_taito-ku_lod2_no_texture/tileset.json",
    // 墨田区 LOD3
    "https://assets.cms.plateau.reearth.io/assets/5d/526931-ac09-44b4-a910-d2331d69c87a/13107_sumida-ku_city_2024_citygml_1_op_bldg_3dtiles_13107_sumida-ku_lod3_no_texture/tileset.json",
  ];

  const loadedTilesets = [];

  for (const url of tilesetUrls) {
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(url);

      applyTilesetPerformanceTuning(tileset);
      applyBuildingStyle(tileset, buildingColor, buildingOpacity);
      registerBuildingForSilhouette(
        tileset,
        scene,
        buildingOutlineColor || buildingColor,
        buildingOutlineWidth
      );

      // 最初の表示時にコールバックを実行
      if (onFirstVisible) {
        const handleFirstVisibility = () => {
          tileset.tileVisible.removeEventListener(handleFirstVisibility);
          onFirstVisible();
        };
        tileset.tileVisible.addEventListener(handleFirstVisibility);
      }

      scene.primitives.add(tileset);
      loadedTilesets.push(tileset);
    } catch (error) {
      console.error(`Failed to load tileset from ${url}:`, error);
    }
  }

  return loadedTilesets;
};

/**
 * 既に読み込んだ建物タイルセットへスタイルを再適用
 * デバッグUIからの色・透明度変更に利用
 */
export const updateBuildingAppearance = ({
  buildingColor,
  buildingOpacity,
}) => {
  buildingTilesets.forEach((tileset) => {
    applyBuildingStyle(tileset, buildingColor, buildingOpacity);
  });
};

/**
 * 建物ハイライト管理
 */
export class BuildingHighlighter {
  constructor(scene, hoverColorHex = "#ff1fa6") {
    this.scene = scene;
    this.hoverColor = Cesium.Color.fromCssColorString(
      hoverColorHex || "#ff1fa6"
    );
    this.highlightState = {
      feature: undefined,
      originalColor: new Cesium.Color(),
    };
  }

  setHoverColor(hoverColorHex) {
    this.hoverColor = Cesium.Color.fromCssColorString(
      hoverColorHex || "#ff1fa6"
    );
  }

  highlight(pickedFeature) {
    if (
      !pickedFeature ||
      !(pickedFeature instanceof Cesium.Cesium3DTileFeature)
    ) {
      return;
    }

    if (this.highlightState.feature === pickedFeature) {
      return;
    }

    // 前のハイライトをクリア
    this.clear();

    // 新しいハイライトを設定
    this.highlightState.feature = pickedFeature;
    Cesium.Color.clone(pickedFeature.color, this.highlightState.originalColor);
    pickedFeature.color = Cesium.Color.clone(
      this.hoverColor,
      new Cesium.Color()
    );
  }

  clear() {
    if (!this.highlightState.feature) {
      return;
    }
    this.highlightState.feature.color = Cesium.Color.clone(
      this.highlightState.originalColor,
      new Cesium.Color()
    );
    this.highlightState.feature = undefined;
  }

  isHighlighted(feature) {
    return this.highlightState.feature === feature;
  }
}

export const getBuildingTilesets = () => buildingTilesets;

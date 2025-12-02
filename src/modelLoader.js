/**
 * Model Loader Module
 * GLTFモデルの読み込みと頂点位置の抽出
 */

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { rotatePositionsAroundX } from "./util.js";

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./static/draco/");

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * GLTFモデルを読み込んで頂点位置を抽出
 * @param {string} modelPath - モデルファイルのパス
 * @param {Function} onPositionsLoaded - 読み込み完了時のコールバック
 */
export const loadGltfModelPositions = (modelPath, onPositionsLoaded) => {
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

/**
 * モデル位置データを管理するクラス
 */
export class ModelPositionStore {
  constructor() {
    this.positions = {
      heart: new Float32Array(),
      love: new Float32Array(),
    };
  }

  setHeartPositions(positions) {
    this.positions.heart = positions;
  }

  setLovePositions(positions) {
    this.positions.love = positions;
  }

  getHeartPositions() {
    return this.positions.heart;
  }

  getLovePositions() {
    return this.positions.love;
  }

  getPositionsForCategory(categoryKey) {
    if (categoryKey === "heart") {
      return this.positions.heart;
    }
    if (categoryKey === "love") {
      return this.positions.love;
    }
    return undefined;
  }
}

// シングルトンインスタンス
export const modelPositionStore = new ModelPositionStore();

/**
 * 全てのモデルを読み込む
 * @param {Object} category - カテゴリ設定オブジェクト
 */
export const loadAllModels = (category) => {
  const models = [
    {
      path: "./heart.glb",
      onLoad: (positions) => {
        modelPositionStore.setHeartPositions(positions);
        if (category.heart) {
          category.heart.numberOfParticles = positions.length / 3;
        }
      },
    },
    {
      path: "./merryme.glb",
      onLoad: (positions) => {
        modelPositionStore.setLovePositions(positions);
        if (category.love) {
          category.love.numberOfParticles = positions.length / 3;
        }
      },
    },
  ];

  models.forEach((model) => {
    loadGltfModelPositions(model.path, model.onLoad);
  });
};

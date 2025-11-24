export const rotatePositionsAroundX = (positions, angleRad) => {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotated = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    rotated[i] = x;
    rotated[i + 1] = y * cos - z * sin;
    rotated[i + 2] = y * sin + z * cos;
  }

  return rotated;
};

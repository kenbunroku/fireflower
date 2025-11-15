uniform vec4 u_color;
uniform float u_time;
uniform float u_bloomDuration;

void main() {
      // 円形スプライトにしたい場合は距離でマスク
  vec2 uv = gl_PointCoord - 0.5;
  if(length(uv) > 0.5)
    discard;

  float alpha = 1. - smoothstep(0.0, 1.0, u_time / u_bloomDuration);

  out_FragColor = vec4(u_color.xyz, u_color.a * alpha);
}

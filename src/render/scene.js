import * as THREE from 'three';

// Cinematic base: golden-hour sun with soft shadows, warm haze, gradient sky.

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe8cfa8, 70, 190);

  // sky dome: warm horizon to steel-blue zenith
  const skyGeo = new THREE.SphereGeometry(420, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x5f8fc4) },
      midColor: { value: new THREE.Color(0xbcd0e4) },
      botColor: { value: new THREE.Color(0xf4d9a8) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 botColor;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(botColor, midColor, smoothstep(0.0, 0.18, h));
        c = mix(c, topColor, smoothstep(0.15, 0.65, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  scene.add(sky);

  return scene;
}

export function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xffeccc, 2.2);
  sun.position.set(-26, 34, 18); // afternoon sun from the south-west
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 4;
  sun.shadow.camera.far = 120;
  const S = 42;
  sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
  sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const sky = new THREE.HemisphereLight(0xbcd4f5, 0x8f7a55, 0.85);
  scene.add(sky);

  const fill = new THREE.DirectionalLight(0xaec6e8, 0.35); // cool bounce fill
  fill.position.set(30, 20, -24);
  scene.add(fill);

  return { sun, hemi: sky, fill };
}

// keep the shadow frustum centred on the camera target as it pans
export function updateSunFollow(lights, target) {
  const { sun } = lights;
  sun.position.set(target.x - 26, 34, target.z + 18);
  sun.target.position.set(target.x, 0, target.z);
  sun.target.updateMatrixWorld();
}

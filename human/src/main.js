// 디지털 휴먼 — 실시간 3D 인물.
// 빌드: README.md 참고 (esbuild 로 ../app.js 한 파일로 묶는다)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderChunk } from 'three';

const $ = s => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = x => clamp(x, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

// 부드러운 1D 값 노이즈. 시드마다 다른 곡선을 준다.
function makeNoise(seed) {
  const p = new Float32Array(256);
  let s = seed * 7919 + 1;
  for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; p[i] = (s / 2147483647) * 2 - 1; }
  const n = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(p[i & 255], p[(i + 1) & 255], u); };
  return t => n(t) * 0.6 + n(t * 2.13 + 17.3) * 0.28 + n(t * 4.71 + 31.7) * 0.12;
}
const NZ = Array.from({ length: 12 }, (_, i) => makeNoise(i + 3));

// ───────────────────────── 렌더러 · 씬 ─────────────────────────
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

// 단위는 cm. 인물은 +Z 를 바라보고 서 있다(키 174cm).
const camera = new THREE.PerspectiveCamera(17, 1, 5, 2000);
const LOOK = new THREE.Vector3(0, 151, 0);
const CAM_BASE = new THREE.Vector3(0, 156, 215);

// 배경: 조명과 무관한 부드러운 그라디언트 + 아주 옅은 얼룩
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 600),
  new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { cA: { value: new THREE.Color('#5d5650') }, cB: { value: new THREE.Color('#141312') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 cA; uniform vec3 cB;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 p = vUv - vec2(0.43, 0.58); p.x *= 1.5;
        float d = length(p);
        vec3 c = mix(cA, cB, smoothstep(0.0, 0.62, d));
        c += (h(floor(vUv*900.0)) - 0.5) * 0.006;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
backdrop.position.set(0, 150, -230);
backdrop.renderOrder = -1;
scene.add(backdrop);

// 조명: 따뜻한 키 라이트(그림자), 차가운 필, 뒤쪽 림 두 개
const key = new THREE.DirectionalLight(0xfff0e2, 2.3);
key.position.set(-70, 215, 130);
key.target.position.copy(LOOK).add(new THREE.Vector3(0, 6, 0));
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 50, far: 450 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.25;
key.shadow.radius = 7;
key.shadow.blurSamples = 16;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xe4ebff, 0.8);
fill.position.set(110, 150, 110);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffe6d0, 2.2);
rim.position.set(90, 200, -140);
rim.target.position.copy(LOOK);
scene.add(rim, rim.target);

const rim2 = new THREE.DirectionalLight(0xe8e6f0, 0.7);
rim2.position.set(-110, 185, -110);
rim2.target.position.copy(LOOK);
scene.add(rim2, rim2.target);

scene.add(new THREE.HemisphereLight(0xfff4ea, 0x2a2420, 0.25));

// ───────────────────────── 후처리 ─────────────────────────
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const film = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
    grain: { value: 0.045 }, vignette: { value: 0.9 }, ca: { value: 0.0018 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vignette, ca; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * ca * (0.4 + r2 * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, smoothstep(0.75, 0.05, r2 * 1.6), vignette * 0.55);
      float n = hash(vUv * res + fract(time * 7.123) * 811.0) + hash(vUv * res * 0.5 + fract(time * 3.7) * 97.0) - 1.0;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += n * grain * (0.35 + 0.65 * (1.0 - l));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(film);

// ───────────────────────── 피부 셰이더 ─────────────────────────
// 직접광 디퓨즈를 채널별로 감싸서(wrap) 명암 경계에 붉은 산란광이 번지게 한다.
const SSS_FROM = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
const SSS_TO = `{
    float nlRaw = dot( geometryNormal, directLight.direction );
    vec3 wrapNL = clamp( ( vec3( nlRaw ) + SKIN_WRAP ) / ( 1.0 + SKIN_WRAP ), 0.0, 1.0 );
    wrapNL *= mix( vec3( 1.0 ), vec3( 1.0, 0.86, 0.80 ), smoothstep( 0.6, 0.0, nlRaw ) );
    reflectedLight.directDiffuse += wrapNL * directLight.color * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
  }`;
function skinify(mat, wrap) {
  mat.onBeforeCompile = sh => {
    const chunk = ShaderChunk.lights_physical_pars_fragment;
    if (!chunk.includes(SSS_FROM)) return; // three 버전이 바뀌면 그냥 기본 셰이딩
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
      `#define SKIN_WRAP vec3(${wrap.join(',')})\n` + chunk.replace(SSS_FROM, SSS_TO));
  };
  mat.customProgramCacheKey = () => 'skin' + wrap.join();
}

// ───────────────────────── 인물 불러오기 ─────────────────────────
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => { $('#loadbar').style.width = (loaded / total * 100).toFixed(0) + '%'; };
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const tex = (name, srgb = false) => {
  const t = texLoader.load('assets/' + name);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
};
const T = {
  headColor: tex('head_color.jpg', true), headNormal: tex('head_normal.jpg'), headRough: tex('head_rough.jpg'),
  bodyColor: tex('body_color.jpg', true), bodyNormal: tex('body_normal.jpg'), hair: tex('hair.webp', true),
};

const M = {
  face: new THREE.MeshPhysicalMaterial({
    map: T.headColor, normalMap: T.headNormal, roughnessMap: T.headRough, roughness: 1,
    specularIntensity: 0.55, sheen: 0.35, sheenColor: new THREE.Color(0.9, 0.55, 0.45), sheenRoughness: 0.55,
    clearcoat: 0.06, clearcoatRoughness: 0.42,
  }),
  eyes: new THREE.MeshPhysicalMaterial({
    map: T.headColor, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.025, specularIntensity: 0.4,
  }),
  hair: new THREE.MeshPhysicalMaterial({
    map: T.hair, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide,
    roughness: 0.5, specularIntensity: 0.45, sheen: 0.12, sheenColor: new THREE.Color(0.3, 0.26, 0.24), sheenRoughness: 0.4,
  }),
  body: new THREE.MeshPhysicalMaterial({
    map: T.bodyColor, normalMap: T.bodyNormal, roughness: 0.78, sheen: 0.2, sheenColor: new THREE.Color(0.8, 0.55, 0.48), sheenRoughness: 0.6,
  }),
};
M.headskin = M.face.clone();
M.headskin.sheen = 0.12;
M.headskin.clearcoat = 0;
M.headskin.roughness = 1.3;
M.hair.color.setRGB(1.2, 1.15, 1.1);
M.lashes = M.hair;
skinify(M.face, [0.5, 0.24, 0.16]);
skinify(M.headskin, [0.5, 0.24, 0.16]);
skinify(M.body, [0.4, 0.2, 0.14]);

const rig = { ready: false };
const gltfLoader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
gltfLoader.load('assets/avatar.glb', gltf => {
  const root = gltf.scene;
  const faces = []; // 얼굴(피부·눈·속눈썹) 프리미티브는 같은 모프를 공유한다
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(m => M[m.name] || m) : (M[o.material.name] || o.material);
    if (o.morphTargetDictionary && o.morphTargetDictionary.eyeBlinkLeft !== undefined) faces.push(o);
  });
  scene.add(root);
  rig.root = root;
  const bone = n => root.getObjectByName('Bip01_' + n);
  Object.assign(rig, {
    spine1: bone('Spine1'), spine2: bone('Spine2'), neck: bone('Neck'), head: bone('Head'),
    lEye: bone('LEye'), rEye: bone('REye'), lClav: bone('L_Clavicle'), rClav: bone('R_Clavicle'),
  });
  poseArms(root, bone);
  root.updateMatrixWorld(true);
  for (const b of ['spine1', 'spine2', 'neck', 'head', 'lEye', 'rEye', 'lClav', 'rClav']) {
    rig[b].userData.rest = rig[b].quaternion.clone();
    rig[b].userData.parentRest = rig[b].parent.getWorldQuaternion(new THREE.Quaternion());
  }
  // 눈 뼈의 정면 방향(부모 공간 기준). 기본 자세에서 인물은 +Z 를 본다.
  for (const e of [rig.lEye, rig.rEye]) {
    const wq = e.getWorldQuaternion(new THREE.Quaternion());
    e.userData.fwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(wq.invert());
  }
  rig.faces = faces;
  // 눈알은 뼈로 돌린다. 모프의 eyeLook* 은 눈꺼풀만 움직이도록 눈알 쪽 변위를 지운다.
  for (const f of faces) {
    if (f.material !== M.eyes) continue;
    const d = f.morphTargetDictionary, ma = f.geometry.morphAttributes;
    for (const name in d) if (name.startsWith('eyeLook')) for (const key in ma) ma[key][d[name]].array.fill(0);
  }
  const dict = faces[0].morphTargetDictionary;
  rig.morphIndex = dict;
  rig.morphNames = Object.keys(dict);
  rig.headPos = rig.head.getWorldPosition(new THREE.Vector3());
  rig.headRest = rig.headPos.clone();
  rig.headSmooth = rig.headPos.clone();
  rig.headFix = rig.head.getWorldQuaternion(new THREE.Quaternion()).invert();
  rig.ready = true;
  // 몸동작(모션캡처)은 얼굴이 뜬 다음에 이어서 받는다
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('assets/anims.glb', a => setupBody(a.animations), undefined, e => console.warn('모션을 불러오지 못했습니다', e));
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 900);
}, undefined, err => {
  console.error(err);
  $('#loadmsg').textContent = '인물을 불러오지 못했습니다. 새로고침해 주세요.';
});

// T자 → 팔을 내린 편한 자세. 위팔이 아래·살짝 앞을 향하도록 월드 기준으로 돌린다.
function poseArms(root, bone) {
  root.updateMatrixWorld(true);
  const aim = (b, child, dir) => {
    const a = b.getWorldPosition(new THREE.Vector3());
    const c = child.getWorldPosition(new THREE.Vector3());
    const cur = c.sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const bw = b.getWorldQuaternion(new THREE.Quaternion());
    const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
    b.updateMatrixWorld(true);
  };
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    aim(bone(s + '_UpperArm'), bone(s + '_Forearm'), new THREE.Vector3(0.2 * sx, -1, 0.04));
    aim(bone(s + '_Forearm'), bone(s + '_Hand'), new THREE.Vector3(0.1 * sx, -1, 0.3));
  }
}

// ───────────────────────── 몸(모션캡처) ─────────────────────────
// Rocketbox 여성 모션캡처. 상태마다 고른 클립을 크로스페이드로 잇는다.
const BODY = {
  idle: [['idle1', 3], ['idle2', 3], ['idle3', 3], ['idle4', 2], ['idle5', 2], ['idle8', 2], ['idle9', 2], ['breathe2', 2], ['breathe3', 2], ['hair1', 0.5]],
  talk: [['talk1', 1], ['talk2', 1], ['talk3', 1], ['talk4', 1], ['talk5', 1], ['talk6', 1]],
  talkHappy: [['talkx1', 1], ['talk4', 1], ['talk5', 1]],
  listen: [['listen1', 1], ['listen2', 1], ['listen3', 1], ['nod1', 0.4], ['nod3', 0.4]],
  nod: [['nod1', 1], ['nod2', 1], ['nod3', 1]],
};
const body = { mixer: null, actions: {}, cur: null, name: '', state: 'idle', until: 0 };
const weighted = list => {
  let r = Math.random() * list.reduce((a, [, w]) => a + w, 0);
  for (const [n, w] of list) if ((r -= w) < 0) return n;
  return list[0][0];
};
function setupBody(clips) {
  body.mixer = new THREE.AnimationMixer(rig.root);
  for (const c of clips) body.actions[c.name] = body.mixer.clipAction(c);
  const st = body.state; body.state = '';
  bodyState(st);
}
function playBody(name, fade = 0.8, once = false) {
  const a = body.actions[name];
  if (!a) return;
  const dur = a.getClip().duration;
  if (a === body.cur && !once) { body.until = S.t + rand(8, 16); return; }
  a.reset();
  a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  a.clampWhenFinished = once;
  if (!once && dur > 8) a.time = Math.random() * dur * 0.6; // 긴 클립은 아무 데서나 시작해 매번 다른 몸짓
  a.fadeIn(fade).play();
  if (body.cur && body.cur !== a) body.cur.fadeOut(fade);
  body.cur = a; body.name = name;
  body.until = S.t + (once ? Math.max(0.5, dur - fade) : Math.min(dur - a.time - fade, rand(9, 20)));
}
const bodyList = () => body.state === 'talk' ? (S.mood === 'happy' ? BODY.talkHappy : BODY.talk) : body.state === 'listen' ? BODY.listen : BODY.idle;
function bodyState(state) {
  if (body.state === state) return;
  if (state === 'afterTalk') { body.state = 'idle'; if (body.mixer) playBody(weighted(BODY.nod), 0.7, true); return; }
  body.state = state;
  if (body.mixer) playBody(weighted(bodyList()), state === 'talk' ? 0.6 : state === 'listen' ? 0.9 : 1.4);
}
function updateBody(dt) {
  if (S.t > body.until) {
    let n = weighted(bodyList());
    if (n === body.name) n = weighted(bodyList());
    playBody(n, body.state === 'talk' ? 0.8 : 1.6);
  }
  body.mixer.update(dt);
}

// ───────────────────────── 표정 ─────────────────────────
const MOODS = {
  neutral: { label: '무표정', w: {} },
  soft: { label: '미소', w: { mouthSmileLeft: 0.45, mouthSmileRight: 0.42, cheekSquintLeft: 0.18, cheekSquintRight: 0.17, eyeSquintLeft: 0.1, eyeSquintRight: 0.1, mouthDimpleLeft: 0.12, mouthDimpleRight: 0.1 } },
  happy: { label: '활짝', w: { mouthSmileLeft: 0.95, mouthSmileRight: 0.9, cheekSquintLeft: 0.6, cheekSquintRight: 0.55, eyeSquintLeft: 0.45, eyeSquintRight: 0.42, mouthUpperUpLeft: 0.22, mouthUpperUpRight: 0.2, jawOpen: 0.1, mouthStretchLeft: 0.1, mouthStretchRight: 0.1, browInnerUp: 0.06 } },
  think: { label: '생각', w: { browDownLeft: 0.28, browDownRight: 0.08, browInnerUp: 0.18, mouthPressLeft: 0.25, mouthPressRight: 0.22, mouthLeft: 0.18, eyeSquintLeft: 0.18, eyeSquintRight: 0.1, mouthRollLower: 0.1 } },
  curious: { label: '궁금', w: { browInnerUp: 0.38, browOuterUpLeft: 0.32, browOuterUpRight: 0.18, eyeWideLeft: 0.18, eyeWideRight: 0.14, mouthPucker: 0.08, jawOpen: 0.02 } },
  surprise: { label: '놀람', w: { browInnerUp: 0.7, browOuterUpLeft: 0.65, browOuterUpRight: 0.65, eyeWideLeft: 0.55, eyeWideRight: 0.55, jawOpen: 0.22, mouthFunnel: 0.15 } },
  sad: { label: '슬픔', w: { browInnerUp: 0.55, browDownLeft: 0.12, browDownRight: 0.12, mouthFrownLeft: 0.35, mouthFrownRight: 0.35, mouthPressLeft: 0.15, mouthPressRight: 0.15, mouthShrugLower: 0.2, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 } },
};
// 자동 모드에서 감정이 흘러가는 비율
const AUTO_FLOW = [['neutral', 0.3], ['soft', 0.36], ['happy', 0.08], ['think', 0.12], ['curious', 0.1], ['sad', 0.04]];

const S = {
  t: 0,
  mode: 'auto', mood: 'neutral', moodNext: 6,
  follow: true, handheld: true,
  pointer: { ndc: new THREE.Vector2(), last: -99 },
  gaze: { mode: 'contact', until: 2.5, target: new THREE.Vector3(), cur: new THREE.Vector3(), focus: new THREE.Vector3(), off: new THREE.Vector2(), aw: new THREE.Vector2(), nextSac: 0, init: false },
  head: { yaw: 0, pitch: 0, roll: 0 },
  base: {}, baseNext: 1, // 표정의 미세한 기저 변동
  listenUntil: 0, phrase: -1, qEnv: 0,
  blink: { next: 1.2, start: -1, dbl: false, v: 0 },
  micro: [], microNext: 2,
  w: {}, // 현재 모프 값
  speech: null, talkEnv: 0, nod: 0,
};

function scheduleBlink(now, soon) {
  // 사람의 깜빡임 간격은 오른쪽 꼬리가 긴 분포(평균 3~4초)
  const gap = soon ? rand(0.15, 0.35) : clamp(0.5 + -Math.log(1 - Math.random()) * (S.speech ? 2.1 : 2.9), 0.6, 9);
  S.blink.next = now + gap;
}
function blinkValue(now) {
  const b = S.blink;
  if (b.start < 0 && now >= b.next) { b.start = now; b.dbl = Math.random() < 0.14; b.dur = rand(0.24, 0.32); }
  if (b.start < 0) return 0;
  const t = now - b.start, close = 0.075, hold = 0.035, open = b.dur - close - hold;
  let v;
  if (t < close) v = (t / close) ** 1.6;
  else if (t < close + hold) v = 1;
  else if (t < b.dur) v = 1 - smooth((t - close - hold) / open);
  else { b.start = -1; scheduleBlink(now, b.dbl); b.dbl = false; v = 0; }
  return v;
}

function addMicro(now) {
  const kinds = [
    { w: { browInnerUp: 0.22, browOuterUpLeft: 0.18, browOuterUpRight: 0.18 }, a: 0.12, h: 0.25, r: 0.35 }, // 눈썹 들썩
    { w: { mouthPressLeft: 0.3, mouthPressRight: 0.3, mouthRollLower: 0.12 }, a: 0.2, h: 0.5, r: 0.4 },    // 입술 다물기
    { w: { mouthSmileLeft: 0.16, cheekSquintLeft: 0.06 }, a: 0.15, h: 0.4, r: 0.5 },                       // 한쪽 입꼬리
    { w: { mouthSmileRight: 0.14, mouthDimpleRight: 0.1 }, a: 0.15, h: 0.4, r: 0.5 },
    { w: { noseSneerLeft: 0.12, noseSneerRight: 0.1, mouthUpperUpLeft: 0.05 }, a: 0.1, h: 0.15, r: 0.25 },   // 코 찡긋
    { w: { mouthShrugLower: 0.2, mouthClose: 0.08, jawForward: 0.06 }, a: 0.25, h: 0.3, r: 0.4 },          // 침 삼키기
    { w: { eyeSquintLeft: 0.15, eyeSquintRight: 0.15 }, a: 0.2, h: 0.6, r: 0.5 },                           // 살짝 눈 가늘게
  ];
  const k = pick(kinds);
  S.micro.push({ ...k, t0: now });
}

// ───────────────────────── 말하기(립싱크) ─────────────────────────
// 초성 19, 중성 21, 종성 28 → 오큘러스 비셈 15종
const CHO = ['KK', 'KK', 'nn', 'DD', 'DD', 'RR', 'PP', 'PP', 'PP', 'SS', 'SS', null, 'CH', 'CH', 'CH', 'KK', 'DD', 'PP', null];
const JUNG = [
  [['aa', 1]], [['E', 0.9]], [['I', 0.5], ['aa', 1]], [['I', 0.5], ['E', 0.9]], [['aa', 0.62], ['O', 0.25]], [['E', 0.85]],
  [['I', 0.5], ['aa', 0.62]], [['I', 0.5], ['E', 0.85]], [['O', 1]], [['U', 0.6], ['aa', 1]], [['U', 0.6], ['E', 0.9]],
  [['U', 0.6], ['E', 0.85]], [['I', 0.5], ['O', 1]], [['U', 1]], [['U', 0.6], ['aa', 0.7]], [['U', 0.6], ['E', 0.85]],
  [['U', 0.6], ['I', 0.8]], [['I', 0.5], ['U', 1]], [['I', 0.55]], [['I', 0.5], ['I', 0.8]], [['I', 0.85]],
];
const JONG = [null, 'KK', 'KK', 'KK', 'nn', 'nn', 'nn', 'DD', 'RR', 'KK', 'PP', 'RR', 'RR', 'RR', 'PP', 'RR', 'PP', 'PP', 'PP', 'DD', 'DD', 'KK', 'DD', 'DD', 'KK', 'DD', 'PP', 'DD'];
const LATIN = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I', b: 'PP', m: 'PP', p: 'PP', f: 'FF', v: 'FF', d: 'DD', t: 'DD', l: 'nn', n: 'nn', s: 'SS', z: 'SS', c: 'KK', k: 'KK', g: 'KK', q: 'KK', x: 'KK', j: 'CH', r: 'RR', w: 'U', h: null };

function buildVisemes(text, rate) {
  const D = 0.17 / rate; // 음절 하나 길이(초)
  const segs = []; const charTime = []; const phrases = [];
  let t = 0, pStart = 0;
  const push = (v, s, d) => { segs.push({ v, s, t0: t, t1: t + d }); t += d; };
  const endPhrase = q => { if (t - pStart > 0.25) phrases.push({ t0: pStart, t1: t, q }); };
  for (let i = 0; i < text.length; i++) {
    charTime[i] = t;
    const ch = text[i], c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const s = c - 0xac00, cho = Math.floor(s / 588), jung = Math.floor((s % 588) / 28), jong = s % 28;
      const ci = CHO[cho], fi = JONG[jong];
      const vd = D * (ci ? 0.52 : 0.72) * (fi ? 0.85 : 1);
      if (ci) push(ci, ci === 'PP' ? 1 : 0.8, Math.max(ci === 'PP' ? 0.06 : 0.03, D * 0.26));
      const vs = JUNG[jung], st = rand(0.78, 1.04); // 음절마다 입을 벌리는 정도가 조금씩 다르다
      if (vs.length === 1) push(vs[0][0], vs[0][1] * st, vd);
      else { push(vs[0][0], vs[0][1] * st, vd * 0.32); push(vs[1][0], vs[1][1] * st, vd * 0.68); }
      if (fi) push(fi, fi === 'PP' ? 1 : 0.7, D * 0.22);
    } else if (/[a-z]/i.test(ch)) {
      const v = LATIN[ch.toLowerCase()];
      push(v || 'Sil', v && 'aeiou'.includes(ch.toLowerCase()) ? 0.9 : 0.75, D * 0.42);
    } else if (/[0-9]/.test(ch)) {
      push('aa', 0.8, D * 0.5); push('E', 0.8, D * 0.5); push('nn', 0.6, D * 0.3);
    } else if (/[.!?…]/.test(ch)) { endPhrase(ch === '?'); push('Sil', 0, 0.42 / rate); pStart = t; }
    else if (/[,·;:]/.test(ch)) { endPhrase(false); push('Sil', 0, 0.24 / rate); pStart = t; }
    else if (/\s/.test(ch)) push('Sil', 0, 0.035 / rate);
  }
  charTime[text.length] = t;
  endPhrase(/\?\s*$/.test(text));
  return { segs, charTime, phrases, dur: t };
}

let koVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang));
  const male = /InJoon|Hyunsu|Minsu|Bong|Gook|male/i;
  koVoice = vs.find(v => !male.test(v.name) && /Google|Yuna|SunHi|Heami|Yujin|Seoyeon|Natural/i.test(v.name))
    || vs.find(v => !male.test(v.name)) || vs[0] || null;
  return koVoice;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function say(text) {
  text = text.trim().slice(0, 300);
  if (!text) return;
  stopSpeech();
  const rate = 1.0;
  const plan = buildVisemes(text, rate);
  const sp = { ...plan, start: performance.now() / 1000 + 0.05, offset: 0, text, synced: false, done: false };
  S.speech = sp;
  S.phrase = -1;
  S.blink.next = Math.min(S.blink.next, S.t + 0.3);
  bodyState('talk');
  if ('speechSynthesis' in window && (koVoice || pickVoice())) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = koVoice; u.lang = koVoice.lang; u.rate = rate; u.pitch = 1.04;
    sp.start = Infinity; // 실제 소리가 나는 순간부터 시계를 돌린다
    u.onstart = () => { sp.start = performance.now() / 1000; };
    u.onboundary = e => {
      if (!isFinite(sp.start) || e.charIndex == null) return;
      const expected = sp.charTime[Math.min(e.charIndex, sp.charTime.length - 1)];
      const elapsed = performance.now() / 1000 - sp.start;
      sp.offset = expected - elapsed; // 엔진의 실제 속도에 맞춰 시간축을 당기거나 늦춘다
      sp.synced = true;
    };
    u.onend = () => { sp.done = true; };
    u.onerror = e => {
      // 끊긴 게 아니라 엔진이 실패한 경우엔 입 모양만이라도 끝까지 움직인다
      if (e.error === 'interrupted' || e.error === 'canceled') sp.done = true;
      else { sp.tts = false; if (!isFinite(sp.start)) sp.start = performance.now() / 1000; }
    };
    sp.tts = true;
    speechSynthesis.speak(u);
    // 음성이 끝내 시작되지 않으면(일부 브라우저) 입 모양만이라도 움직인다
    setTimeout(() => { if (!isFinite(sp.start) && S.speech === sp) sp.start = performance.now() / 1000; }, 1200);
  } else {
    toast('이 브라우저에는 한국어 음성이 없어 입 모양만 움직입니다.');
  }
}
function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  S.speech = null;
}

function speechTime(sp) { return isFinite(sp.start) ? performance.now() / 1000 - sp.start + sp.offset : -1; }
function visemeAt(sp, now) {
  if (!isFinite(sp.start)) return null;
  const t = now - sp.start + sp.offset;
  if (sp.done) return 'end';
  if (t > sp.dur + 0.15) {
    if (!sp.tts || sp.synced || t > sp.dur * 1.6 + 1) return 'end';
    // 음성이 예상보다 느리게 끝나는 중: 소리가 끝날 때까지 가볍게 말하는 입 모양을 이어 간다
    const k = Math.floor((t - sp.dur) / 0.16);
    return { v: ['aa', 'E', 'O', 'I'][k % 4], s: 0.55, phase: 0, idx: -1 - k };
  }
  // 이진 탐색
  let lo = 0, hi = sp.segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sp.segs[m].t0 <= t) lo = m; else hi = m - 1; }
  const s = sp.segs[lo];
  if (!s || t < 0) return { v: 'Sil', s: 0, phase: 0 };
  return { v: s.v, s: s.s, phase: (t - s.t0) / Math.max(1e-3, s.t1 - s.t0), idx: lo };
}

// ───────────────────────── 시선 ─────────────────────────
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
const ray = new THREE.Raycaster();

// 사람은 상대를 계속 쳐다보지 않는다. 응시와 회피를 번갈아 하고, 말할 땐 문장 머리에서 시선을 돌린다.
function setGaze(now, mode, dur, thinking) {
  const g = S.gaze, prev = g.mode;
  g.mode = mode;
  if (mode === 'away') {
    const dirs = thinking || S.mood === 'think'
      ? [[-1, 0.9], [1, 0.9], [-0.5, 1], [0.5, 1]]
      : [[-1, -0.35], [1, -0.35], [-0.8, 0.1], [0.8, 0.1], [0.15, -1], [-1, -0.75], [1, -0.75]];
    const [dx, dy] = pick(dirs), amp = rand(24, 58); // 카메라 평면에서 cm (약 6~15°)
    g.aw.set(dx * amp + rand(-6, 6), dy * amp * 0.7 + rand(-4, 4));
    g.until = now + (dur || rand(0.7, 2.6));
  } else {
    g.aw.set(0, 0);
    g.until = now + (dur || rand(1.8, 5.5));
  }
  if (prev !== mode && Math.random() < 0.45) scheduleBlink(now, true); // 큰 시선 이동엔 깜빡임이 자주 붙는다
}

function updateGazeTarget(now, dt) {
  const g = S.gaze;
  camera.matrixWorld.extractBasis(camRight, camUp, tmpV);
  const pointerActive = S.follow && now - S.pointer.last < 2.5;
  const listening = now < S.listenUntil;
  if (now > g.until && !S.speech) {
    if (g.mode === 'away' || Math.random() < (listening ? 0.85 : 0.55)) setGaze(now, 'contact', listening ? rand(2.5, 6) : 0);
    else setGaze(now, 'away');
  }
  if (S.speech && now > g.until && g.mode === 'away') setGaze(now, 'contact', 30);
  // 미세 도약 안구 운동: 응시 중엔 상대의 두 눈과 입 사이를, 회피 중엔 근처를 오간다
  if (now > g.nextSac) {
    g.nextSac = now + rand(0.3, 1.5);
    if (g.mode === 'contact') g.off.set(pick([-3.2, 3.2, 0, -3.2, 3.2]), pick([0, 0, -4.5, 1]));
    else g.off.set(rand(-6, 6), rand(-4, 4));
  }
  if (pointerActive) {
    ray.setFromCamera(S.pointer.ndc, camera);
    g.target.copy(ray.ray.origin).addScaledVector(ray.ray.direction, camera.position.distanceTo(LOOK) * 0.55);
  } else {
    g.target.copy(camera.position).addScaledVector(camRight, g.off.x + g.aw.x).addScaledVector(camUp, g.off.y + g.aw.y);
  }
  if (!g.init) { g.cur.copy(g.target); g.focus.copy(g.target); g.init = true; }
  // 눈은 빠르게(도약 운동 약 40ms), 머리가 바라보는 지점은 느리게 따라간다
  g.cur.lerp(g.target, 1 - Math.exp(-26 * dt));
  g.focus.lerp(g.target, 1 - Math.exp(-(g.mode === 'contact' ? 2.2 : 1.6) * dt));
}

// 애니메이션이 정한 자세 위에 월드 축 회전을 덧붙인다: local' = P⁻¹·R·P·local
const _pq = new THREE.Quaternion(), _pqi = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ');
function addWorldRot(b, x, y, z) {
  b.parent.getWorldQuaternion(_pq);
  _pqi.copy(_pq).invert();
  _rq.setFromEuler(_eu.set(x, y, z, 'YXZ'));
  b.quaternion.premultiply(_pq).premultiply(_rq).premultiply(_pqi);
}

function aimEye(e, target, headFwdQ) {
  e.parent.updateWorldMatrix(true, false);
  const pos = e.getWorldPosition(tmpV);
  const dir = tmpV2.copy(target).sub(pos).normalize();
  // 머리 기준 각도로 제한(사람 눈은 ±30° 남짓)
  const local = dir.clone().applyQuaternion(headFwdQ.clone().invert());
  let yaw = Math.atan2(local.x, local.z), pitch = Math.asin(clamp(local.y, -1, 1));
  yaw = clamp(yaw, -0.5, 0.5); pitch = clamp(pitch, -0.38, 0.32);
  const lim = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(headFwdQ);
  const pw = e.parent.getWorldQuaternion(tmpQ);
  const want = lim.applyQuaternion(pw.invert());
  const restDir = e.userData.fwdLocal.clone().applyQuaternion(e.userData.rest);
  e.quaternion.setFromUnitVectors(restDir, want).multiply(e.userData.rest);
  return { yaw, pitch };
}

// ───────────────────────── 매 프레임 ─────────────────────────
const target = {};
function animate(now, dt) {
  if (!rig.ready) return;
  const g = S.gaze, h = S.head;

  // 감정 흐름
  if (S.mode === 'auto' && now > S.moodNext && !S.speech) {
    let r = Math.random(), m = 'neutral';
    for (const [k, p] of AUTO_FLOW) { if ((r -= p) < 0) { m = k; break; } }
    S.mood = m; S.moodNext = now + rand(4, 10);
    if (m === 'think') setGaze(now, 'away', rand(1, 2.5), true);
  }
  if (now > S.microNext) { addMicro(now); S.microNext = now + rand(1.8, 5.5); }

  // 말하는 중: 구(문장 조각)가 바뀔 때 시선·끄덕임
  if (S.speech) {
    const st = speechTime(S.speech), ph = S.speech.phrases;
    let pi = -1;
    for (let i = 0; i < ph.length; i++) if (st >= ph[i].t0 - 0.05) pi = i;
    if (pi !== S.phrase && pi >= 0) {
      S.phrase = pi;
      const len = ph[pi].t1 - ph[pi].t0;
      // 말을 꺼낼 때 생각하듯 시선을 돌렸다가, 구의 끝에서 다시 눈을 맞춘다
      if (Math.random() < (pi === 0 ? 0.45 : 0.6) && len > 0.8) setGaze(now, 'away', Math.min(len * 0.45, rand(0.5, 1.3)), Math.random() < 0.5);
      else setGaze(now, 'contact', 30);
      if (Math.random() < 0.5) S.nodKick = 1;
    }
    const cur = ph[S.phrase];
    S.qTarget = cur && cur.q && st > cur.t1 - 0.7 ? 1 : 0;
  } else S.qTarget = 0;
  S.qEnv = damp(S.qEnv, S.qTarget || 0, 5, dt);
  if (!S.speech && body.state === 'listen' && now > S.listenUntil) bodyState('idle');

  updateGazeTarget(now, dt);

  // 몸: 모션캡처 클립. 아직 안 받았으면 쉬는 자세로 되돌린 뒤 덧붙인다
  if (body.mixer) updateBody(dt);
  else for (const b of [rig.spine2, rig.neck, rig.head]) b.quaternion.copy(b.userData.rest);
  rig.root.updateMatrixWorld(true);

  // 호흡: 모션에도 들어 있지만 가슴을 조금 더
  const br = 0.5 - 0.5 * Math.cos(now * Math.PI * 2 / (4.3 + NZ[3](now * 0.05) * 0.6));
  addWorldRot(rig.spine2, -br * (body.mixer ? 0.006 : 0.016), 0, 0);

  // 머리: 모션캡처의 움직임은 살리고, 바라보는 지점 쪽으로 일부만 보정한다(눈이 먼저, 머리는 늦게)
  rig.head.getWorldPosition(rig.headPos);
  const F = tmpV.set(0, 0, 1).applyQuaternion(rig.head.getWorldQuaternion(tmpQ).multiply(rig.headFix));
  const D = tmpV2.copy(g.focus).sub(rig.headPos).normalize();
  let eYaw = Math.atan2(D.x, D.z) - Math.atan2(F.x, F.z);
  eYaw = Math.atan2(Math.sin(eYaw), Math.cos(eYaw));
  const ePitch = Math.asin(clamp(D.y, -1, 1)) - Math.asin(clamp(F.y, -1, 1));
  const pointerActive = S.follow && now - S.pointer.last < 2.5;
  const follow = pointerActive ? 0.65 : g.mode === 'contact' ? 0.8 : 0.5;
  const moodTilt = S.mood === 'curious' ? 0.09 : S.mood === 'think' ? -0.05 : S.mood === 'sad' ? 0.04 : 0;
  const amp = body.mixer ? 0.35 : 1; // 모션이 있으면 노이즈는 조금만
  h.yaw = damp(h.yaw, clamp(eYaw * follow, -0.6, 0.6) + NZ[0](now * 0.11) * 0.06 * amp, 4.0, dt);
  h.pitch = damp(h.pitch, clamp(-ePitch * follow, -0.35, 0.35) + NZ[1](now * 0.13) * 0.04 * amp + (S.mood === 'sad' ? 0.07 : 0) + S.nod - S.qEnv * 0.05, 4.2, dt);
  h.roll = damp(h.roll, NZ[2](now * 0.09) * 0.045 * amp + moodTilt + S.qEnv * 0.05, 2.2, dt);
  addWorldRot(rig.neck, h.pitch * 0.4, h.yaw * 0.4, h.roll * 0.4);
  rig.neck.updateMatrixWorld(true);
  addWorldRot(rig.head, h.pitch * 0.6, h.yaw * 0.6, h.roll * 0.6);
  rig.root.updateMatrixWorld(true);
  // 쉬는 자세 대비 머리 회전(정면 +Z 가 지금 어디를 향하는지)
  const headFwdQ = rig.head.getWorldQuaternion(new THREE.Quaternion()).multiply(rig.headFix);
  // 눈은 같은 점을 본다(수렴), 아주 작은 떨림 추가
  const jit = tmpV.set(NZ[7](now * 3.1) * 0.25, NZ[8](now * 2.7) * 0.25, 0);
  const tgt = g.cur.clone().add(jit);
  const la = aimEye(rig.lEye, tgt, headFwdQ);
  aimEye(rig.rEye, tgt, headFwdQ);

  // ── 모프 목표값 합성 ──
  for (const k of rig.morphNames) target[k] = 0;
  const add = (k, v) => { if (k in target) target[k] += v; };
  const mw = MOODS[S.mood].w;
  const moodAmt = S.speech ? 0.55 : 1;
  for (const k in mw) add(k, mw[k] * moodAmt);
  // 미세표정
  S.micro = S.micro.filter(m => {
    const t = now - m.t0, e = t < m.a ? smooth(t / m.a) : t < m.a + m.h ? 1 : 1 - smooth((t - m.a - m.h) / m.r);
    if (t > m.a + m.h + m.r) return false;
    for (const k in m.w) add(k, m.w[k] * e);
    return true;
  });
  // 표정의 기저가 1~4초마다 아주 조금씩 바뀐다(가만히 있는 얼굴도 완전히 멈춰 있지 않다)
  if (now > S.baseNext) {
    S.baseNext = now + rand(1, 4);
    const keys = ['mouthRollLower', 'mouthRollUpper', 'mouthStretchLeft', 'mouthStretchRight', 'mouthPucker', 'mouthPressLeft', 'mouthPressRight',
      'mouthSmileLeft', 'mouthSmileRight', 'eyeSquintLeft', 'eyeSquintRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekSquintLeft'];
    for (const k in S.base) if (Math.random() < 0.5) S.base[k] = 0;
    for (let i = 0; i < 3; i++) S.base[pick(keys)] = Math.random() ** 2 * 0.24;
  }
  const mouthQuiet = S.speech ? 0.35 : 1;
  for (const k in S.base) add(k, S.base[k] * (k.startsWith('mouth') ? mouthQuiet : 1));
  // 질문 끝: 눈썹이 올라간다
  add('browInnerUp', S.qEnv * 0.3); add('browOuterUpLeft', S.qEnv * 0.22); add('browOuterUpRight', S.qEnv * 0.22);
  // 눈꺼풀: 편하게 살짝 내려온 기본값 + 시선을 따라간다
  add('eyeLookDownLeft', 0.08); add('eyeLookDownRight', 0.08);
  add('eyeLookUpLeft', clamp01(la.pitch / 0.32) * 0.5); add('eyeLookUpRight', clamp01(la.pitch / 0.32) * 0.5);
  add('eyeLookDownLeft', clamp01(-la.pitch / 0.38) * 0.65); add('eyeLookDownRight', clamp01(-la.pitch / 0.38) * 0.65);
  add('eyeLookOutLeft', clamp01(la.yaw / 0.5) * 0.3); add('eyeLookInRight', clamp01(la.yaw / 0.5) * 0.3);
  add('eyeLookInLeft', clamp01(-la.yaw / 0.5) * 0.3); add('eyeLookOutRight', clamp01(-la.yaw / 0.5) * 0.3);
  // 호흡에 따라 콧볼이 아주 조금
  add('noseSneerLeft', br * 0.03); add('noseSneerRight', br * 0.03);
  add('jawOpen', (1 - br) * 0.012);

  // 말하기
  let talking = 0;
  if (S.speech) {
    const vz = visemeAt(S.speech, performance.now() / 1000);
    if (vz === 'end') {
      S.speech = null; S.blink.next = Math.min(S.blink.next, now + 0.25);
      bodyState(Math.random() < 0.6 ? 'afterTalk' : 'idle');
      if (S.mode === 'auto' && Math.random() < 0.6) S.micro.push({ w: { mouthSmileLeft: 0.3, mouthSmileRight: 0.28, cheekSquintLeft: 0.12, cheekSquintRight: 0.1 }, a: 0.3, h: 1.2, r: 0.8, t0: now });
      setGaze(now, 'contact', rand(1.5, 3));
    }
    else if (vz) {
      talking = 1;
      if (vz.v !== 'Sil') add('viseme_' + vz.v, vz.s * 0.95);
      // 음절 머리에서 고개·눈썹으로 강세
      if (vz.idx !== S.lastSeg) {
        S.lastSeg = vz.idx;
        if (vz.v === 'aa' || vz.v === 'O' || vz.v === 'E') { if (Math.random() < 0.12) S.nodKick = 1; if (Math.random() < 0.06) addMicro(now); }
      }
    }
  }
  S.talkEnv = damp(S.talkEnv, talking, 4, dt);
  S.nodKick = damp(S.nodKick || 0, 0, 7, dt);
  S.nod = damp(S.nod, (S.nodKick || 0) * 0.035, 10, dt);
  add('browInnerUp', S.talkEnv * 0.08 * (0.5 + 0.5 * NZ[9](now * 0.7)));
  add('browOuterUpLeft', S.talkEnv * 0.06 * Math.max(0, NZ[10](now * 0.8)));

  // 깜빡임: 시선 변화가 크면 따라 깜빡인다
  const bl = blinkValue(now);
  const sq = (target.eyeSquintLeft || 0);
  const blinkL = bl, blinkR = clamp01(bl * 0.97 + (bl > 0 ? 0.02 : 0));

  // 부드럽게 따라가기: 입 모양은 빠르게, 표정은 천천히
  for (const k of rig.morphNames) {
    const tv = clamp01(target[k]);
    const isVis = k.startsWith('viseme_');
    const speed = isVis ? 22 : k.startsWith('eyeLook') ? 30 : k.startsWith('eyeBlink') ? 1e9 : 4.5;
    S.w[k] = damp(S.w[k] || 0, tv, speed, dt);
  }
  S.w.eyeBlinkLeft = clamp01(blinkL + sq * 0.15);
  S.w.eyeBlinkRight = clamp01(blinkR + sq * 0.15);
  const idx = rig.morphIndex;
  for (const f of rig.faces) { const inf = f.morphTargetInfluences; for (const k of rig.morphNames) inf[idx[k]] = S.debugW ? (S.debugW[k] || 0) : S.w[k]; }
}

// 핸드헬드 카메라: 아주 작은 흔들림과 숨쉬는 듯한 줌
function updateCamera(now, dt) {
  const a = S.handheld ? 1 : 0;
  // 몸이 움직여도 얼굴이 화면에서 벗어나지 않게, 카메라맨처럼 천천히 따라간다
  const fx = rig.ready ? (rig.headSmooth.lerp(rig.headPos, 1 - Math.exp(-1.4 * dt)), rig.headSmooth.x - rig.headRest.x) : 0;
  const fy = rig.ready ? (rig.headSmooth.y - rig.headRest.y) * 0.9 : 0;
  const fz = rig.ready ? rig.headSmooth.z - rig.headRest.z : 0; // 앞으로 숙이면 같이 물러나 크기를 유지
  camera.position.set(
    CAM_BASE.x + fx * 0.7 + NZ[11](now * 0.23) * 0.9 * a,
    CAM_BASE.y + fy + lookYOff + NZ[3](now * 0.19 + 50) * 0.6 * a,
    CAM_BASE.z + fz + NZ[5](now * 0.07 + 20) * 2.5 * a,
  );
  camera.lookAt(LOOK.x + fx + NZ[6](now * 0.31 + 9) * 0.25 * a, LOOK.y + fy + lookYOff + NZ[7](now * 0.27 + 4) * 0.2 * a, LOOK.z + fz);
}

// ───────────────────────── 크기 · 품질 ─────────────────────────
let quality = 'high';
let lookYOff = 0;
const LOCK_Q = new URLSearchParams(location.search).has('hq'); // 자동 화질 낮춤 끄기
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = quality === 'high' ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // 세로 화면에서는 어깨까지, 가로 화면에서는 가슴까지 보이도록 화각을 맞춘다
  const portrait = w / h < 0.8;
  camera.fov = portrait ? 15 : 14;
  lookYOff = portrait ? -1.5 : 0; // 세로 화면은 아래 조작부를 피해 얼굴을 위쪽에
  camera.updateProjectionMatrix();
  film.uniforms.res.value.set(w * pr, h * pr);
}
addEventListener('resize', resize);
resize();

// ───────────────────────── 루프 · 녹화 ─────────────────────────
const timer = new THREE.Timer();
let shotPending = false, frames = 0, fpsT = 0, lowFps = 0;
function loop() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  S.t += dt;
  updateCamera(S.t, dt);
  animate(S.t, dt);
  film.uniforms.time.value = S.t;
  composer.render();
  if (shotPending) { shotPending = false; canvas.toBlob(b => download(b, `digital-human-${stamp()}.png`), 'image/png'); }
  // 느린 기기는 자동으로 가벼운 화질로
  frames++; fpsT += dt;
  if (fpsT > 3) {
    const fps = frames / fpsT; frames = 0; fpsT = 0;
    if (rig.ready && !LOCK_Q && quality === 'high' && fps < 28 && ++lowFps >= 2) setQuality('low', true);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function setQuality(q, auto) {
  quality = q;
  key.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
  if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  rt.samples = q === 'high' ? 4 : 0;
  resize();
  $('#q').textContent = q === 'high' ? '화질: 높음' : '화질: 가볍게';
  if (auto) toast('기기 성능에 맞춰 가벼운 화질로 바꿨어요.');
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

let rec = null;
function toggleRecord() {
  if (rec) { rec.stop(); return; }
  if (!window.MediaRecorder || !canvas.captureStream) { toast('이 브라우저는 화면 녹화를 지원하지 않아요.'); return; }
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'];
  const type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const stream = canvas.captureStream(30);
  const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
  const chunks = [];
  r.ondataavailable = e => e.data.size && chunks.push(e.data);
  const btn = $('#rec'), t0 = performance.now();
  const tick = setInterval(() => { btn.querySelector('span').textContent = '녹화 중 ' + fmt((performance.now() - t0) / 1000); if (performance.now() - t0 > 60000) r.stop(); }, 250);
  r.onstop = () => {
    clearInterval(tick); rec = null; btn.classList.remove('on'); btn.querySelector('span').textContent = '영상 녹화';
    const mime = r.mimeType || type || 'video/webm';
    download(new Blob(chunks, { type: mime }), `digital-human-${stamp()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
  };
  r.start(250); rec = r; btn.classList.add('on');
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ───────────────────────── UI ─────────────────────────
addEventListener('pointermove', e => {
  if (e.target.closest && e.target.closest('.panel')) return;
  const r = canvas.getBoundingClientRect();
  S.pointer.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  S.pointer.last = S.t;
});

const moodBar = $('#moods');
const moodBtns = [['auto', '자연스럽게'], ...Object.entries(MOODS).map(([k, v]) => [k, v.label])];
for (const [k, label] of moodBtns) {
  const b = document.createElement('button');
  b.className = 'chip' + (k === 'auto' ? ' on' : ''); b.textContent = label; b.dataset.mood = k;
  b.onclick = () => {
    moodBar.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    if (k === 'auto') { S.mode = 'auto'; S.moodNext = S.t + 1; }
    else { S.mode = 'manual'; S.mood = k; if (k === 'surprise') scheduleBlink(S.t, true); }
  };
  moodBar.appendChild(b);
}

const LINES = [
  '안녕하세요. 저는 브라우저 안에서 실시간으로 움직이는 디지털 휴먼이에요.',
  '오늘 하루는 어떠셨어요? 저는 당신을 기다리고 있었어요.',
  '마우스를 움직여 보세요. 제가 눈으로 따라갈게요.',
  '사진도 찍고, 영상으로 녹화해서 저장할 수도 있어요.',
];
const linesEl = $('#lines');
LINES.forEach(l => {
  const b = document.createElement('button'); b.className = 'line'; b.textContent = l;
  b.onclick = () => { $('#text').value = l; say(l); };
  linesEl.appendChild(b);
});
$('#sayform').onsubmit = e => { e.preventDefault(); say($('#text').value); };
// 글을 쓰는 동안엔 귀 기울여 듣는 몸짓과 눈 맞춤
$('#text').addEventListener('input', () => {
  if (S.speech) return;
  S.listenUntil = S.t + 3.5;
  bodyState('listen');
  if (S.gaze.mode === 'away') setGaze(S.t, 'contact', rand(2, 4));
});
$('#shot').onclick = () => { shotPending = true; };
$('#rec').onclick = toggleRecord;
$('#q').onclick = () => setQuality(quality === 'high' ? 'low' : 'high');
$('#follow').onclick = e => { S.follow = !S.follow; e.currentTarget.classList.toggle('on', S.follow); };
$('#hand').onclick = e => { S.handheld = !S.handheld; e.currentTarget.classList.toggle('on', S.handheld); };
$('#hide').onclick = () => document.body.classList.toggle('clean');
addEventListener('keydown', e => { if (e.key === 'h' && e.target === document.body) document.body.classList.toggle('clean'); });

// 테스트용 훅
window.__human = { S, rig, say, MOODS, setQuality, camera, CAM_BASE, LOOK, body, setGaze };

/* ============================================================================
   웹 푸시 보내기 — 라이브러리 없이 WebCrypto 만으로. Deno(Supabase Edge Function)와 Node 둘 다에서 돈다.

   두 가지를 한다.
     · VAPID (RFC 8292) — "이 알림은 우리 서버가 보낸다" 는 서명. ES256 JWT.
     · 내용 암호화 (RFC 8291, aes128gcm) — 푸시 서비스(구글·애플·모질라)는 알림을 전해 주기만 하고
       내용은 못 읽는다. 받는 브라우저만 풀 수 있다.
   test-push.mjs 가 RFC 8291 부록 A 의 예제와 한 바이트까지 맞는지 본다.
   ========================================================================== */
const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function b64e(bytes){
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function b64d(str){
  const s = atob(String(str).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export function concat(...parts){
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const utf8 = (s) => te.encode(s);

async function hmac(key, data){
  const k = await subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", k, data));
}
/* HKDF 는 쓰는 길이가 32바이트 이하라 T(1) 한 번이면 된다. */
async function expand(prk, info, len){
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, len);
}

/* 비공개 키(d)와 공개 키(0x04‖x‖y 65바이트)를 JWK 로 — WebCrypto 는 날것의 비공개 키를 못 받는다. */
function jwk(publicRaw, privateD){
  return { kty: "EC", crv: "P-256", x: b64e(publicRaw.slice(1, 33)), y: b64e(publicRaw.slice(33, 65)), d: privateD, ext: true };
}
export async function ecdhKeys(publicB64, privateB64){
  const raw = b64d(publicB64);
  return {
    rawPublic: raw,
    privateKey: await subtle.importKey("jwk", jwk(raw, privateB64), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])
  };
}

/* 두 쪽이 똑같이 거치는 열쇠 만들기. uaPublic 은 브라우저, asPublic 은 이번 알림에만 쓰는 서버 쪽 공개 키. */
async function derive(ecdhSecret, authSecret, uaPublic, asPublic, salt){
  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await expand(prkKey, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const prk = await hmac(salt, ikm);
  return {
    cek: await expand(prk, utf8("Content-Encoding: aes128gcm\0"), 16),
    nonce: await expand(prk, utf8("Content-Encoding: nonce\0"), 12)
  };
}

/** 받는 브라우저의 구독(p256dh, auth)에 맞춰 암호화한 본문. opts.salt·opts.asKeys 는 시험 때만 준다. */
export async function encrypt(plaintext, sub, opts = {}){
  const uaPublic = b64d(sub.p256dh);
  const authSecret = b64d(sub.auth);
  const salt = opts.salt || globalThis.crypto.getRandomValues(new Uint8Array(16));
  let as = opts.asKeys;
  if (!as) {
    const kp = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    as = { privateKey: kp.privateKey, rawPublic: new Uint8Array(await subtle.exportKey("raw", kp.publicKey)) };
  }
  const uaKey = await subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const { cek, nonce } = await derive(secret, authSecret, uaPublic, as.rawPublic, salt);
  /* 레코드 하나: 내용 + 0x02(마지막 레코드 표시). 덧붙임은 두지 않는다. */
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);                       // 레코드 크기 4096
  return concat(salt, rs, new Uint8Array([as.rawPublic.length]), as.rawPublic, ct);
}

/** 거꾸로 — 브라우저가 하는 일. 시험에서만 쓴다. ua 는 ecdhKeys() 로 만든 받는 쪽 열쇠. */
export async function decrypt(body, ua, authB64){
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const asKey = await subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
  const { cek, nonce } = await derive(secret, b64d(authB64), ua.rawPublic, asPublic, salt);
  const key = await subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const rec = new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, ct));
  let end = rec.length - 1;
  while (end >= 0 && rec[end] === 0) end--;                        // 덧붙인 0 을 걷고
  if (rec[end] !== 2) throw new Error("마지막 레코드 표시가 없습니다");
  return rec.slice(0, end);
}

/** VAPID 머리. aud 는 푸시 서비스의 출처, exp 는 24시간을 넘지 못한다(여기선 12시간). */
export async function vapidAuth(endpoint, vapid, now = Date.now()){
  const head = b64e(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64e(utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })));
  const unsigned = head + "." + body;
  const key = await subtle.importKey("jwk", jwk(b64d(vapid.publicKey), vapid.privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned)));   // r‖s 64바이트 = JWS ES256
  return "vapid t=" + unsigned + "." + b64e(sig) + ", k=" + vapid.publicKey;
}

/** 알림 하나 보내기. gone 이면 그 구독은 끝났다(브라우저가 알림을 끄거나 앱을 지움) — 지워야 한다.
    TTL 은 세 시간: 그보다 늦게 닿는 현장 소식은 상한 정보다(앱의 신선도와 같은 선). */
export async function sendPush(sub, payload, vapid, opts = {}){
  const f = opts.fetch || globalThis.fetch;
  const body = await encrypt(utf8(JSON.stringify(payload)), sub);
  const res = await f(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttl != null ? opts.ttl : 3 * 3600),
      Urgency: "normal"
    },
    body
  });
  return { status: res.status, ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410 };
}

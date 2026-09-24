/* 폰 알림용 VAPID 키 한 쌍을 만든다.   node correspondent/tools/vapid-keys.mjs
   공개 키는 config.js 의 vapidPublicKey 와 Edge Function 비밀 둘 다에, 비공개 키는 Edge Function 비밀에만 넣는다.
   비공개 키가 새면 누구든 이 앱 이름으로 알림을 보낼 수 있다 — 저장소에 올리지 말 것. */
const { subtle } = globalThis.crypto;
const b64 = (u8) => Buffer.from(u8).toString('base64url');
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
const { d } = await subtle.exportKey('jwk', kp.privateKey);
console.log('config.js  →  vapidPublicKey: "' + b64(pub) + '"');
console.log('');
console.log('supabase secrets set \\');
console.log('  VAPID_PUBLIC_KEY=' + b64(pub) + ' \\');
console.log('  VAPID_PRIVATE_KEY=' + d + ' \\');
console.log('  VAPID_SUBJECT=mailto:<운영자 메일> \\');
console.log('  PUSH_WEBHOOK_SECRET=' + b64(globalThis.crypto.getRandomValues(new Uint8Array(24))));

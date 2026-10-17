// RFC 8291 (aes128gcm) and RFC 8292 (VAPID), using Worker-native Web Crypto.
const utf8 = new TextEncoder();
export function unbase64(value:string):Uint8Array<ArrayBuffer> {
 if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('Invalid base64url');
 return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}
export function base64(value:Uint8Array){return btoa(String.fromCharCode(...value)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
const concat=(...parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
async function hmac(key:Uint8Array<ArrayBuffer>,data:Uint8Array<ArrayBuffer>){return new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),data));}
export function validPushEndpoint(endpoint:string){
 try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname.length>1&&endpoint.length<=2048&&(
 u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));
 }catch{return false;}
}
export type PushKeys={p256dh:string;auth:string};
export async function validatePushKeys(keys:PushKeys){
 const pub=unbase64(keys.p256dh),auth=unbase64(keys.auth);
 if(pub.length!==65||pub[0]!==4||auth.length!==16)throw new Error('Invalid push keys');
 await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[]);
}
export async function encryptPush(payload:string,keys:PushKeys,fixture?:{keyPair:CryptoKeyPair;salt:Uint8Array<ArrayBuffer>}){
 const plain=utf8.encode(payload);if(plain.length>3000)throw new Error('Push payload too large');
 const ua=unbase64(keys.p256dh),auth=unbase64(keys.auth);
 const keyPair=fixture?.keyPair??await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const pub=new Uint8Array(await crypto.subtle.exportKey('raw',keyPair.publicKey));
 const receiver=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},keyPair.privateKey,256));
 const ikm=await hmac(await hmac(auth,shared),concat(utf8.encode('WebPush: info\0'),ua,pub,new Uint8Array([1])));
 const salt=fixture?.salt??crypto.getRandomValues(new Uint8Array(16));
 const prk=await hmac(salt,ikm);
 const cek=(await hmac(prk,concat(utf8.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16);
 const nonce=(await hmac(prk,concat(utf8.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const aes=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},aes,concat(plain,new Uint8Array([2]))));
 const record=new Uint8Array(5);new DataView(record.buffer).setUint32(0,4096);record[4]=65;
 return concat(salt,record,pub,encrypted);
}
export type VapidConfig={publicKey:string;privateJwk:string;subject:string};
export async function vapidAuthorization(endpoint:string,config:VapidConfig,now=Date.now()){
 const header=base64(utf8.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
 const claims=base64(utf8.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+43200,sub:config.subject})));
 const key=await crypto.subtle.importKey('jwk',JSON.parse(config.privateJwk),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode(header+'.'+claims)));
 return `vapid t=${header}.${claims}.${base64(signature)}, k=${config.publicKey}`;
}
export async function sendPush(endpoint:string,keys:PushKeys,payload:unknown,config:VapidConfig,topic:string,transport:typeof fetch=fetch){
 if(!validPushEndpoint(endpoint))return {status:410,retryAfter:0};
 const [body,authorization]=await Promise.all([encryptPush(JSON.stringify(payload),keys),vapidAuthorization(endpoint,config)]);
 const response=await transport(endpoint,{method:'POST',headers:{Authorization:authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal',Topic:topic.replace(/[^A-Za-z0-9_-]/g,'').slice(0,32)},body,redirect:'manual',signal:AbortSignal.timeout(6000)});
 const retry=response.headers.get('Retry-After');
 const retryAfter=retry?Math.max(0,/^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry)-Date.now()):0;
 await response.body?.cancel();return {status:response.status,retryAfter:Number.isFinite(retryAfter)?Math.min(retryAfter,86400000):0};
}

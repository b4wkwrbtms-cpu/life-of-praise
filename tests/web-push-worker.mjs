import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {base64} from '../lib/web-push.ts';
const require=createRequire(import.meta.url);const {Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const cfg={publicKey:base64(new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey))),privateJwk:JSON.stringify(await crypto.subtle.exportKey('jwk',key.privateKey)),subject:'https://app.test'};
const receiver=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const keys={p256dh:base64(new Uint8Array(await crypto.subtle.exportKey('raw',receiver.publicKey))),auth:base64(crypto.getRandomValues(new Uint8Array(16)))};
const code=ts.transpileModule(readFileSync('lib/web-push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
let requests=0;
const mf=new Miniflare({modules:true,script:code+`\nexport default {async fetch(req,env){try {return Response.json(await sendPush('https://fcm.googleapis.com/fcm/send/test',env.KEYS,{title:'콘티'},env.CFG,'test'))}catch(e){return Response.json({error:e.message,stack:e.stack},{status:500})}}}`,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{CFG:cfg,KEYS:keys},outboundService:async req=>{requests++;assert.ok(req.headers.get('authorization').startsWith('vapid t='));return new Response('',{status:201})}});
try{const response=await mf.dispatchFetch('https://app.test/'),data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.status,201);assert.equal(requests,1);console.log('PASS: native Worker Web Crypto and encrypted outbound VAPID request.')}finally{await mf.dispose()}

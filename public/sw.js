// Notifications only. Authenticated pages and score files are never cached here.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{}}catch{}
 const noticeId=typeof payload.noticeId==='string'&&/^[a-f0-9-]{36}$/.test(payload.noticeId)?payload.noticeId:'';
 event.waitUntil(self.registration.showNotification(typeof payload.title==='string'?payload.title.slice(0,100):'생명의 찬양',{body:typeof payload.body==='string'?payload.body.slice(0,240):'앱에서 새 소식을 확인해 주세요.',icon:'/icon-192.png',badge:'/icon-192.png',tag:noticeId?'worship-'+noticeId:'praise-device-test',data:{noticeId},renotify:false}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const raw=event.notification.data?.noticeId;
 const noticeId=typeof raw==='string'&&/^[a-f0-9-]{36}$/.test(raw)?raw:'';
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const target=windows.find(client=>new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname==='/');
  // Do not navigate/reload a window with an unsaved score editor.
  if(target){target.postMessage({type:'PRAISE_NOTIFICATION',noticeId});await target.focus();return;}
  await self.clients.openWindow('/?'+(noticeId?'notice='+encodeURIComponent(noticeId):'notifications=1'));
 })());
});

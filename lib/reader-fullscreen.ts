type FullscreenDocument = Document & {
  webkitFullscreenElement?:Element|null;
  webkitExitFullscreen?:()=>Promise<void>|void;
};
type FullscreenElement = HTMLElement & {webkitRequestFullscreen?:()=>Promise<void>|void};
export function readerFullscreenElement(doc:Document):Element|null {
  return doc.fullscreenElement||(doc as FullscreenDocument).webkitFullscreenElement||null;
}
// Request directly from a user gesture. Unsupported browsers keep the in-app view.
export async function requestReaderFullscreen(element:HTMLElement|null):Promise<boolean> {
  if(!element)return false;
  try {
    if(element.requestFullscreen)await element.requestFullscreen({navigationUI:'hide'});
    else if((element as FullscreenElement).webkitRequestFullscreen)await (element as FullscreenElement).webkitRequestFullscreen!();
    else return false;
    return true;
  } catch {return false}
}
export async function exitReaderFullscreen(element:HTMLElement|null):Promise<void> {
  if(!element||readerFullscreenElement(element.ownerDocument)!==element)return;
  const doc=element.ownerDocument as FullscreenDocument;
  try {
    if(doc.exitFullscreen)await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch { /* Browser dismissal and component close may happen together. */ }
}

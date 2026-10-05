'use client';
import {useEffect,useState} from 'react';
import {Download,Share2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';

// Opening the platform sheet must happen in a fresh click, not after rendering/uploading.
export default function ImageSaveDialog({image,onClose}:{image:{blob:Blob;name:string};onClose:()=>void}){
 const [url,setUrl]=useState(''),[sharing,setSharing]=useState(false),[canShare,setCanShare]=useState(false);
 useEffect(()=>{const u=URL.createObjectURL(image.blob);setUrl(u);setCanShare(!!navigator.canShare?.({files:[new File([image.blob],image.name,{type:'image/png'})]}));return()=>URL.revokeObjectURL(u)},[image]);
 const share=async()=>{setSharing(true);try{await navigator.share({files:[new File([image.blob],image.name,{type:'image/png'})],title:image.name})}catch(e){if((e as Error).name!=='AbortError')toast.error('공유 메뉴를 열지 못했습니다. 다운로드하거나 아래 이미지를 길게 눌러 저장해 주세요.')}finally{setSharing(false)}};
 return <Dialog open onOpenChange={v=>!v&&!sharing&&onClose()}><DialogContent className="image-save-dialog"><DialogTitle>악보 이미지가 준비되었습니다</DialogTitle><DialogDescription>아이폰·아이패드는 ‘저장·공유’에서 이미지 저장을 선택하세요. 메뉴가 지원되지 않으면 이미지를 길게 눌러 저장할 수 있습니다.</DialogDescription><div className="image-save-actions">{canShare&&<button className="primary" disabled={sharing} onClick={share}><Share2 size={18}/>{sharing?'공유 메뉴 열림…':'저장·공유'}</button>}<a className="secondary" href={url||undefined} download={image.name}><Download size={18}/>PNG 다운로드</a></div>{url&&<div className="image-save-preview"><img src={url} alt={image.name}/></div>}<small>이 창을 닫으면 편집하던 악보와 위치로 돌아갑니다.</small></DialogContent></Dialog>;
}

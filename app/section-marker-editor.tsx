'use client';
import {useEffect,useState} from 'react';
import {MapPin,Trash2,X} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {SECTIONS,type Song,type ScorePage,type SectionMarker} from '@/lib/types';
import {sectionMarkerText} from '@/lib/client';
import {Picker} from './ui';
import ScorePreview from './score-preview';

export default function SectionMarkerEditor({page,song,onChange,meta,disabled=false}:{page?:ScorePage;song:Song;onChange:(patch:Partial<Song>)=>void;meta:string;disabled?:boolean}){
 const [placing,setPlacing]=useState<SectionMarker['type']|null>(null),[selected,setSelected]=useState('');
 useEffect(()=>{setPlacing(null);setSelected('');},[page?.id]);
 const markers=song.markers||[],visible=markers.filter(m=>m.pageId===page?.id),marker=visible.find(m=>m.id===selected);
 const edit=(id:string,patch:Partial<SectionMarker>)=>onChange({markers:markers.map(m=>m.id===id?{...m,...patch}:m)});
 const add=(x:number,y:number)=>{if(!page||!placing||markers.length>=200)return;const id=crypto.randomUUID();onChange({markers:[...markers,{id,pageId:page.id,type:placing,x,y,size:.018}]});setSelected(id);setPlacing(null);};
 return <><fieldset className="section-marker-tools" disabled={disabled||!page}>
  <div className="row spread"><h3><MapPin size={17}/>악보 위 구간 표시</h3><span className="marker-count">이 페이지 {visible.length}개</span></div>
  <p>구간을 고른 뒤 오선 위의 빈 곳을 누르세요. 작은 테두리 상자를 원하는 위치로 끌어 옮길 수 있어요.</p>
  <div className="marker-type-buttons">{SECTIONS.map(type=><button type="button" key={type} aria-pressed={placing===type} className={placing===type?'active':''} disabled={markers.length>=200} onClick={()=>{setPlacing(placing===type?null:type);setSelected('');}}>{type==='V'?'V · Verse':type==='C'?'C · Chorus':type}</button>)}</div>
  {placing&&<div className="marker-placement" role="status"><MapPin size={16}/><span><strong>{sectionMarkerText(placing)}</strong> 표시할 위치를 악보에서 눌러 주세요.</span><button type="button" aria-label="구간 배치 취소" onClick={()=>setPlacing(null)}><X size={18}/></button></div>}
  {visible.length>0&&<div className="marker-list" aria-label="이 페이지의 구간 표시">{[...visible].sort((a,b)=>a.y-b.y).map((m,i)=><button type="button" key={m.id} aria-pressed={selected===m.id} className={selected===m.id?'selected':''} onClick={()=>{setSelected(m.id);setPlacing(null);}}>{sectionMarkerText(m.type)}<small>{i+1}</small></button>)}</div>}
  {marker&&<div className="marker-controls">
   <div className="row spread"><Picker label="선택한 구간 종류" value={marker.type} onChange={type=>edit(marker.id,{type:type as SectionMarker['type']})} options={SECTIONS.map(type=>({value:type,label:type==='V'?'V · Verse':type==='C'?'C · Chorus':type}))}/><button type="button" className="text-button danger" onClick={()=>{onChange({markers:markers.filter(m=>m.id!==marker.id)});setSelected('');}}><Trash2 size={16}/>삭제</button></div>
   <div className="slider-field"><span>가로 위치</span><Slider aria-label="구간 표시 가로 위치" disabled={disabled} min={0} max={.98} step={.001} value={[marker.x??.02]} onValueChange={([x])=>edit(marker.id,{x})}/></div>
   <div className="slider-field"><span>세로 위치</span><Slider aria-label="구간 표시 세로 위치" disabled={disabled} min={0} max={.97} step={.001} value={[marker.y]} onValueChange={([y])=>edit(marker.id,{y})}/></div>
   <div className="slider-field"><span>표시 크기</span><Slider aria-label="구간 표시 글자 크기" disabled={disabled} min={.014} max={.045} step={.001} value={[marker.size]} onValueChange={([size])=>edit(marker.id,{size})}/></div>
  </div>}
  <small className="marker-sharing">임시저장 후 ‘팀에 공개’를 누르면 팀 악보와 저장 이미지에 함께 반영됩니다. 상단 송폼 순서는 그대로 유지됩니다.</small>
 </fieldset>
 <ScorePreview page={page} song={song} meta={meta} selectedMarker={selected} placing={!!placing&&!disabled} onMarkerPlace={disabled?undefined:add} onMarkerSelect={setSelected} onMarkerMove={disabled?undefined:(id,x,y)=>edit(id,{x,y})}/>
 </>;
}

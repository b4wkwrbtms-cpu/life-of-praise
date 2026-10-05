'use client';
import {useEffect,useRef,useState} from 'react';
import {Hand,MapPin,Move,Trash2} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {SECTIONS as FORM_SECTIONS,type Song,type ScorePage,type SectionMarker,type Layout} from '@/lib/types';
import {sectionMarkerText} from '@/lib/client';
import {Picker} from './ui';
import ScorePreview from './score-preview';
import ScoreAdjustment from './score-adjustment';
const SECTIONS=FORM_SECTIONS.filter(s=>s!=='Cx2'&&s!=='Bridge x 2');
export default function SectionMarkerEditor({page,song,onChange,meta,disabled=false}:{page?:ScorePage;song:Song;onChange:(patch:Partial<Song>)=>void;meta:string;disabled?:boolean}){
 const [mode,setMode]=useState<'scroll'|'form'|'markers'>('scroll'),[placing,setPlacing]=useState<SectionMarker['type']|null>(null),[selected,setSelected]=useState(''),[zoom,setZoom]=useState(100),[showControls,setShowControls]=useState(false);
 const viewport=useRef<HTMLDivElement>(null);
 useEffect(()=>{setPlacing(null);setSelected('');setMode('scroll');setZoom(100);setShowControls(false);viewport.current?.scrollTo({top:0,left:0})},[page?.id]);
 const markers=song.markers||[],marker=markers.find(m=>m.id===selected&&m.pageId===page?.id),layout=page?.layout??song.layout;
 const edit=(id:string,patch:Partial<SectionMarker>)=>onChange({markers:markers.map(m=>m.id===id?{...m,...patch}:m)});
 const changeLayout=(patch:Partial<Layout>)=>{if(page)onChange({pages:song.pages.map(p=>p.id===page.id?{...p,layout:{...layout,...patch}}:p)})};
 const add=(x:number,y:number)=>{if(!page||!placing||markers.length>=200)return;const id=crypto.randomUUID();onChange({markers:[...markers,{id,pageId:page.id,type:placing,x,y,size:.025}]});setSelected(id);setPlacing(null)};
 return <div className="score-workbench">
  <fieldset className="score-modebar" disabled={disabled||!page}>
   <div className="score-modes" aria-label="악보 조작 모드">
    {([{id:'scroll',label:'스크롤',icon:Hand},{id:'form',label:'송폼 이동',icon:Move},{id:'markers',label:'구간 표시',icon:MapPin}] as const).map(m=><button type="button" key={m.id} aria-pressed={mode===m.id} className={mode===m.id?'active':''} onClick={()=>{setMode(m.id);setPlacing(null);setShowControls(false)}}><m.icon size={16}/>{m.label}</button>)}
   </div><select aria-label="악보 화면 배율" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[100,125,150,200].map(n=><option value={n} key={n}>{n===100?'화면 맞춤':n+'%'}</option>)}</select>
  </fieldset>
  <p className="score-mode-hint" role="status">{mode==='scroll'?'빈 악보는 스크롤 · 위에서 편집 모드를 선택하세요.':mode==='form'?(layout.margin?'상단 여백에 고정된 송폼입니다. 여백을 끄면 악보 위로 이동할 수 있습니다.':'송폼은 끌어서 이동 · 빈 악보는 스크롤'):placing?sectionMarkerText(placing)+' · 원하는 위치를 누르세요. 밀면 스크롤됩니다.':'표시는 끌어서 이동 · 빈 악보는 스크롤'}</p>
  <div className="score-viewport" ref={viewport}><ScorePreview page={page} song={song} meta={meta} zoom={zoom} editing={mode!=='scroll'&&!disabled} formSelected={mode==='form'} onFormMove={mode==='form'&&!layout.margin&&!disabled?(x,y)=>changeLayout({x,y}):undefined} selectedMarker={mode==='markers'?selected:undefined} placing={mode==='markers'&&!!placing&&!disabled} onMarkerPlace={disabled?undefined:add} onMarkerSelect={setSelected} onMarkerMove={mode==='markers'&&!disabled?(id,x,y)=>edit(id,{x,y}):undefined}/></div>
  {mode==='markers'&&<fieldset className="marker-palette" disabled={disabled||!page}><span>구간 추가</span><div className="marker-type-buttons">{SECTIONS.map(type=><button type="button" key={type} aria-pressed={placing===type} className={placing===type?'active':''} disabled={markers.length>=200} onClick={()=>{setPlacing(placing===type?null:type);setSelected('');setShowControls(false)}}>{type==='V'?'V · Verse':type==='C'?'C · Chorus':type}</button>)}</div></fieldset>}
  {mode!=='scroll'&&<button type="button" className="score-controls-toggle" disabled={mode==='markers'&&!marker} aria-expanded={showControls} onClick={()=>setShowControls(!showControls)}>{showControls?'크기·위치 조절 닫기':mode==='markers'?(marker?'선택한 표시 크기·위치 조절':'표시를 선택하면 크기·위치를 조절할 수 있어요'):'송폼 크기·위치 조절'}</button>}
  {mode!=='scroll'&&showControls&&<fieldset className="score-controls" disabled={disabled||!page}>
   {mode==='form'?<><div className="row spread"><strong>현재 페이지 송폼</strong><label className="row"><span>상단 여백</span><Switch checked={layout.margin} onCheckedChange={margin=>changeLayout({margin})}/></label></div>
    <ScoreAdjustment label="글자 크기" min={.008} max={.2} step={.002} value={layout.size} onChange={size=>changeLayout({size})}/>
    <ScoreAdjustment label="가로 위치" max={.98} step={.005} value={layout.x} onChange={x=>changeLayout({x})}/>
    <ScoreAdjustment label="세로 위치" max={.97} step={.005} value={layout.y} disabled={layout.margin} onChange={y=>changeLayout({y})}/>
    <ScoreAdjustment label="송폼 너비" min={.1} max={1} step={.01} value={layout.width} onChange={width=>changeLayout({width})}/>
   </>:<>
    <div className="marker-selection-tools">{marker?<><div className="row spread"><Picker label="선택한 구간 종류" value={marker.type} onChange={type=>edit(marker.id,{type:type as SectionMarker['type']})} options={SECTIONS.map(type=>({value:type,label:sectionMarkerText(type)}))}/><button type="button" className="text-button danger" onClick={()=>{onChange({markers:markers.filter(m=>m.id!==marker.id)});setSelected('')}}><Trash2 size={16}/>선택 표시 삭제</button></div>
     <ScoreAdjustment label="선택 크기" min={.014} max={.1} step={.002} value={marker.size} onChange={size=>edit(marker.id,{size})}/>
     <ScoreAdjustment label="가로 위치" max={.98} step={.005} value={marker.x??.02} onChange={x=>edit(marker.id,{x})}/>
     <ScoreAdjustment label="세로 위치" max={.97} step={.005} value={marker.y} onChange={y=>edit(marker.id,{y})}/>
    </>:<p className="subtle">위에서 구간을 골라 추가하거나, 악보에 있는 표시를 선택해 주세요. 선택한 표시만 변경됩니다.</p>}</div>
   </>}
  </fieldset>}
 </div>;
}

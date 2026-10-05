'use client';
import {Slider} from '@/components/ui/slider';
export default function ScoreAdjustment({label,value,min=0,max=1,step=.001,onChange,disabled=false}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(v:number)=>void;disabled?:boolean}){
 const apply=(v:number)=>onChange(Math.max(min,Math.min(max,Math.round(v*10000)/10000)));
 return <div className="score-adjustment"><span>{label}</span><button type="button" aria-label={label+' 줄이기'} disabled={disabled||value<=min} onClick={()=>apply(value-step)}>−</button><Slider aria-label={label} disabled={disabled} min={min} max={max} step={step} value={[value]} onValueChange={([v])=>apply(v)}/><button type="button" aria-label={label+' 늘리기'} disabled={disabled||value>=max} onClick={()=>apply(value+step)}>+</button><output>{Number((value*100).toFixed(1))}%</output></div>;
}

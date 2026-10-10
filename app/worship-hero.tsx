import type {ReactNode} from 'react';

export default function WorshipHero({kind='week',title,description,detail,actions}:{kind?:'week'|'entry';title:string;description:string;detail?:ReactNode;actions?:ReactNode}){
 return <section className={'worship-hero worship-hero-'+kind} aria-label={kind==='entry'?'생명의 찬양 소개':'이번 주 예배'}>
  <picture className="worship-hero-image" aria-hidden="true"><source media="(max-width: 700px)" srcSet="/images/worship-dawn-mobile.webp"/><img src="/images/worship-dawn.webp" alt="" width={1672} height={941} fetchPriority="high"/></picture>
  <div className="worship-hero-shade"/>
  <div className="worship-hero-masthead" aria-hidden="true">PRAISE<span>.</span></div>
  <div className="worship-hero-content"><div><span className="worship-hero-kicker">LIFE OF PRAISE <span>말씀과 찬양, 함께.</span></span><h1>{title}</h1><p>{description}</p>{actions&&<div className="worship-hero-actions">{actions}</div>}</div>{detail&&<div className="worship-hero-detail">{detail}</div>}</div>
 </section>;
}

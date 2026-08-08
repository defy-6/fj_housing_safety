"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import DataIntakeDialog from "./DataIntakeDialog";
import {StackedBar,Donut,Heatmap,Radar,Funnel,Treemap,LogBars} from "./charts";

type MetricDef={metric_id:string;metric_name:string;metric_path:string;topic:string;category:string;unit:string};
type RegionDef={region_id:string;region_name:string;region_level:string;parent_region_id:string|null;canonical_city:string|null;region_type:string};
type AnalyticsData={meta:{metricCount:number;regionCount:number;years:number[];qualityChecks:Record<string,number>};metrics:MetricDef[];regions:RegionDef[];values:Record<string,Record<string,Record<string,number>>>};
type Feature={properties:{name:string;city?:string};geometry:{type:string;coordinates:any[]}};
type GeoData={features:Feature[]};
type FunctionalZone={properties:{name:string;city:string;kind:string;sourceUnitKey:string};geometry:{type:"Point";coordinates:[number,number]}};
type FunctionalZoneData={features:FunctionalZone[]};

const PALETTE=["#dff3ff","#bfe6fa","#8dcef0","#58adde","#267fb7"];
const PALETTE_RISK=["#fff3ee","#ffd9cc","#f8a892","#e96a4d","#b3271a"];
const PALETTE_SAFE=["#e9f7ee","#c2e8d1","#8fd3aa","#4fb17d","#1d7a4f"];
const metricValence=(m:MetricDef):"negative"|"positive"|"neutral"=>{const p=m.metric_path;if(p.includes("已整治"))return"positive";if(p.includes("整治中")||p.includes("未整治"))return"negative";if(m.topic==="暂无隐患建筑潜在风险")return"negative";if(p.includes("重大安全隐患")||p.includes("一般安全隐患"))return"negative";if(p.includes("暂无安全隐患"))return"positive";return"neutral"};
const valencePalette=(m:MetricDef)=>metricValence(m)==="negative"?PALETTE_RISK:metricValence(m)==="positive"?PALETTE_SAFE:PALETTE;
const fmt=(value:number,digits=0)=>new Intl.NumberFormat("zh-CN",{useGrouping:false,maximumFractionDigits:digits}).format(value||0);
const metricGroup=(metric:MetricDef)=>{const parts=metric.metric_path.split(" / ");return parts.length>2?parts.slice(1,-1).join(" / "):"核心指标"};
const KEY_TYPES=["经营性自建房","人员密集场所","九小场所","多业态混合经营场所","大跨度建筑","历史建筑"];
const MODULES=[
  {id:"overview",label:"综合总览",scope:"总体态势",topics:["房屋基础信息"],categories:["排查情况","排查结论"],defaultMetric:"basic.c026",chartTitle:"全省房屋安全核心指标",focus:["房屋与排查总体规模","安全隐患等级构成","地市、区县空间差异"],panel:{kind:"funnel",title:"排查转化漏斗",sub:"排查 → 经营性自建房 → 隐患分级"}},
  {id:"profile",label:"房屋现状",scope:"基础画像",topics:["房屋基础信息"],categories:["建成年代","房屋结构","排查情况"],defaultMetric:"basic.c007",chartTitle:"房屋年代与结构构成",focus:["不同建成年代构成","主要房屋结构类型","重点房屋类型分布"],panel:{kind:"stackedAge",title:"各地市建成年代构成",sub:"7 个年代区间 · 100% 堆叠"}},
  {id:"hazard",label:"隐患分布",scope:"隐患识别",topics:["房屋基础信息"],categories:["排查结论",...KEY_TYPES],defaultMetric:"basic.c004",chartTitle:"隐患等级与重点类型",focus:["一般与重大安全隐患","六类重点房屋隐患","区域隐患数量排名"],panel:{kind:"heatmap",title:"六类场所 × 地市 重大隐患",sub:"颜色越深隐患越重"}},
  {id:"governance",label:"排查整治",scope:"治理闭环",topics:["房屋基础信息","安全隐患整治"],categories:["排查情况",...KEY_TYPES],defaultMetric:"basic.c026",chartTitle:"排查规模与整治状态",focus:["年度排查工作进展","整治中与未整治存量","封房、加固、拆除等措施"],panel:{kind:"stackedGovern",title:"整治状态构成（按场所）",sub:"已整治 / 整治中 / 未整治 · 100% 堆叠"}},
  {id:"special",label:"重点专项",scope:"分类治理",topics:["房屋基础信息","安全隐患整治"],categories:KEY_TYPES,defaultMetric:"basic.c027",chartTitle:"六类重点房屋专题",focus:["经营性自建房","人员密集与九小场所","大跨度及历史建筑"],panel:{kind:"radar",title:"六类重点房屋规模",sub:"选中区域 · 相对规模（根号刻度）"}},
  {id:"risk",label:"风险体检",scope:"潜在风险",topics:["暂无隐患建筑潜在风险"],categories:[],defaultMetric:"potential_risk.c054",chartTitle:"暂无隐患房屋潜在风险",focus:["老旧房屋与历史建筑","改造及承重结构变化","结构变形损伤与维护风险"],panel:{kind:"treemap",title:"潜在风险规模构成",sub:"8 类风险 · 面积代表规模"}},
];

function geometryPoints(feature:Feature):[number,number][]{
  const result:[number,number][]=[];
  const walk=(value:any)=>{if(Array.isArray(value)&&typeof value[0]==="number")result.push(value as [number,number]);else if(Array.isArray(value))value.forEach(walk)};
  walk(feature.geometry.coordinates);return result;
}

function MapPanel({provinceFeatures,cityFeatures,countyFeatures,functionalZones,cityValues,unitValues,metricName,selectedCity,selectedUnitKey,onSelectCity,onSelectUnit,onOpenDetails,onBack,palette,cityCuts,localCuts}:{
  provinceFeatures:Feature[];cityFeatures:Feature[];countyFeatures:Feature[];functionalZones:FunctionalZone[];
  cityValues:Record<string,number>;unitValues:Record<string,number>;metricName:string;selectedCity:string;selectedUnitKey:string;onSelectCity:(name:string)=>void;onSelectUnit:(key:string)=>void;onOpenDetails:()=>void;onBack:()=>void;
  palette:string[];cityCuts:number[];localCuts:number[];
}){
  const [view,setView]=useState({x:0,y:0,k:1});
  const [hovered,setHovered]=useState<{name:string;value:number;detail?:string}|null>(null);
  const drag=useRef<{x:number;y:number;vx:number;vy:number}|null>(null);
  useEffect(()=>setView({x:0,y:0,k:1}),[selectedCity]);
  const selectedCounties=selectedCity?countyFeatures.filter(f=>f.properties.city===selectedCity):countyFeatures;
  const countyLevel=Boolean(selectedCity)||view.k>=1.65;
  const features=selectedCity?selectedCounties:countyLevel?countyFeatures:cityFeatures;
  const visibleCities=selectedCity?cityFeatures.filter(f=>f.properties.name===selectedCity):cityFeatures;
  const visibleCounties=selectedCity?selectedCounties:countyFeatures;
  const zones=selectedCity?functionalZones.filter(z=>z.properties.city===selectedCity):functionalZones;
  const bounds=selectedCity?selectedCounties:provinceFeatures;
  const points=bounds.flatMap(geometryPoints),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=760,height=590,pad=38,scale=Math.min((width-pad*2)/Math.max(.1,maxX-minX),(height-pad*2)/Math.max(.1,maxY-minY));
  const project=([x,y]:[number,number])=>[pad+(x-minX)*scale,height-pad-(y-minY)*scale];
  const path=(feature:Feature)=>{const polygon=(poly:any[])=>poly.map(ring=>ring.map((p:[number,number],i:number)=>`${i?"L":"M"}${project(p).join(",")}`).join("")+"Z").join("");return feature.geometry.type==="Polygon"?polygon(feature.geometry.coordinates):feature.geometry.coordinates.map(polygon).join("")};
  const featureValue=(f:Feature)=>countyLevel?(unitValues[`${f.properties.city}|${f.properties.name}`]||0):(cityValues[f.properties.name]||0);
  const cuts=countyLevel?localCuts:cityCuts;
  const valueColor=(v:number)=>palette[v<=cuts[0]?0:v<=cuts[1]?1:v<=cuts[2]?2:v<=cuts[3]?3:4];
  const legend=[`≤ ${fmt(cuts[0])}`,`${fmt(cuts[0])} < 值 ≤ ${fmt(cuts[1])}`,`${fmt(cuts[1])} < 值 ≤ ${fmt(cuts[2])}`,`${fmt(cuts[2])} < 值 ≤ ${fmt(cuts[3])}`,`> ${fmt(cuts[3])}`];
  const labels=(()=>{const candidates=features.map(feature=>{const pp=geometryPoints(feature).map(project),px=pp.map(p=>p[0]),py=pp.map(p=>p[1]);return{feature,x:(Math.min(...px)+Math.max(...px))/2,y:(Math.min(...py)+Math.max(...py))/2,area:(Math.max(...px)-Math.min(...px))*(Math.max(...py)-Math.min(...py))}}).filter(c=>Number.isFinite(c.x));if(!countyLevel)return candidates;const accepted:typeof candidates=[],boxes:{left:number;right:number;top:number;bottom:number}[]=[];for(const c of candidates.sort((a,b)=>b.area-a.area)){const name=c.feature.properties.name.replace("综合试验区","");const sx=view.x+c.x*view.k,sy=view.y+c.y*view.k,w=name.length*9+10,box={left:sx-w/2-3,right:sx+w/2+3,top:sy-11,bottom:sy+8};if(boxes.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top))continue;boxes.push(box);accepted.push(c)}return accepted})();
  const zoom=(factor:number,anchor={x:width/2,y:height/2})=>setView(v=>{const k=Math.min(8,Math.max(1,v.k*factor)),ratio=k/v.k;return{k,x:anchor.x-(anchor.x-v.x)*ratio,y:anchor.y-(anchor.y-v.y)*ratio}});
  const selectedUnitName=selectedUnitKey.split("|")[1]||"";
  const selectedScopeName=selectedUnitName||selectedCity||"福建省";
  const selectedScopeValue=selectedUnitKey?unitValues[selectedUnitKey]||0:selectedCity?cityValues[selectedCity]||0:0;
  return <section className="mapCard"><div className="panelHead"><div><span>空间态势 · {countyLevel?"区县级":"地市级"}</span><h2>{selectedScopeName} · {metricName}</h2></div><div className="crumb"><button onClick={onBack}>福建省</button>{selectedCity&&<><i>/</i><button onClick={()=>onSelectUnit("")}>{selectedCity}</button></>}{selectedUnitName&&<><i>/</i><b>{selectedUnitName}</b></>}</div></div><div className="mapWrap">
    <svg className="map" viewBox={`0 0 ${width} ${height}`} onWheel={e=>{e.preventDefault();const matrix=e.currentTarget.getScreenCTM(),point=matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):{x:width/2,y:height/2};zoom(e.deltaY<0?1.2:.83,point)}} onPointerDown={e=>{drag.current={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const currentDrag=drag.current;if(!currentDrag)return;const nextX=currentDrag.vx+e.clientX-currentDrag.x,nextY=currentDrag.vy+e.clientY-currentDrag.y;setView(v=>({...v,x:nextX,y:nextY}))}} onPointerUp={e=>{const d=drag.current;drag.current=null;if(!d)return;if((e.clientX-d.x)**2+(e.clientY-d.y)**2>49)return;const el=document.elementFromPoint(e.clientX,e.clientY) as Element|null,target=el?.closest?.("[data-region]");if(!target)return;const v=target.getAttribute("data-region")||"";if(v.startsWith("p:"))onSelectCity(v.slice(2));else if(v.startsWith("c:"))onSelectUnit(v.slice(2));else if(v.startsWith("u:"))onSelectUnit(v.slice(2))}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {features.map(f=>{const value=featureValue(f),key=`${f.properties.city}|${f.properties.name}`,active=countyLevel?selectedUnitKey===key:selectedCity===f.properties.name;return <path key={`${f.properties.city||"p"}-${f.properties.name}`} d={path(f)} fill={valueColor(value)} className={active?"region active":"region"} data-region={countyLevel?`c:${key}`:`p:${f.properties.name}`} onMouseEnter={()=>setHovered({name:f.properties.name,value})} onMouseLeave={()=>setHovered(null)}/>})}
        {visibleCounties.map(f=><path key={`c-${f.properties.city}-${f.properties.name}`} d={path(f)} className="countyBoundaryOverlay"/>)}
        {visibleCities.map(f=><path key={`s-${f.properties.name}`} d={path(f)} className="cityBoundaryOverlay"/>)}
        {!countyLevel&&provinceFeatures.map(f=><path key={`p-${f.properties.name}`} d={path(f)} className="provinceBoundaryOverlay"/>)}
        {countyLevel&&zones.map(z=>{const[cx,cy]=project(z.geometry.coordinates),value=unitValues[z.properties.sourceUnitKey]||0;return <circle key={z.properties.sourceUnitKey} cx={cx} cy={cy} r={5/view.k} fill={valueColor(value)} className={selectedUnitKey===z.properties.sourceUnitKey?"functionalZonePoint active":"functionalZonePoint"} data-region={`u:${z.properties.sourceUnitKey}`} onMouseEnter={()=>setHovered({name:z.properties.name,value,detail:`${z.properties.city} · ${z.properties.kind} · 近似点位`})} onMouseLeave={()=>setHovered(null)}/>})}
        {labels.map(({feature,x,y})=><text key={`l-${feature.properties.city}-${feature.properties.name}`} x={x} y={y} style={{fontSize:`${(countyLevel?11.8:11.2)/view.k}px`,fontWeight:countyLevel?500:700,strokeWidth:countyLevel?2.2:3.2}}>{feature.properties.name.replace("综合试验区","")}</text>)}
      </g>
    </svg>
    <div className="mapTools"><button onClick={()=>zoom(1.28)}>＋</button><button onClick={()=>zoom(.78)}>−</button><button onClick={()=>setView({x:0,y:0,k:1})}>复位</button></div>
    {(selectedCity||selectedUnitKey)&&<button className="backProvince" onClick={onBack}>← 返回福建省</button>}
    <div className="legend"><span>{metricName}（栋）</span><div>{palette.map((color,i)=><label key={color}><i style={{background:color}}/><small>{legend[i]}</small></label>)}</div>{countyLevel&&<p><b className="pointLegend"/>圆点：开发区/功能区</p>}</div>
    {hovered&&<div className="tooltip"><b>{hovered.name}</b>{hovered.detail&&<small>{hovered.detail}</small>}<span>{metricName} {fmt(hovered.value)} 栋</span></div>}
    {(selectedCity||selectedUnitKey)&&<div className="selectionSummary"><small>当前选中</small><b>{selectedScopeName}</b><span>{metricName}：{fmt(selectedScopeValue)} 栋</span><em>指标卡与两侧图表已同步</em><button onClick={onOpenDetails}>查看区域详细信息</button></div>}
    <p className="mapHint">滚轮缩放 · 区县级显示功能区独立点位</p>
  </div></section>;
}

const AGE_COLORS=["#c9d6df","#1f4e79","#2e6da4","#4a90c2","#6fb1dd","#9bc9e8","#c8e2f4"];
const GOVERN_COLORS=["#4fb17d","#e8b64c","#e96a4d"];

/** 模块专属图表：按 MODULES[].panel.kind 分发渲染，数据从 analytics 现算 */
function ModuleInsight({kind,data,regions,scopeId,year,value,palette,onSelect}:{
  kind:string;data:AnalyticsData;regions:RegionDef[];scopeId:string;year:string;
  value:(rid:string,y?:string,mid?:string)=>number;palette:string[];
  onSelect:(item:{name:string;value:number;detail?:string})=>void;
}){
  const cityList=regions.filter(r=>r.region_level==="city"||r.region_level==="special_city");
  const localList=regions.filter(r=>r.region_level==="local");
  const scopeRegion=regions.find(r=>r.region_id===scopeId);
  const metric=(mid:string)=>data.metrics.find(m=>m.metric_id===mid);
  // 当前尺度参照区域：省=地市；市/区县=该市下辖区县（stackedAge/heatmap 共用）
  const scopeLevel=scopeRegion?.region_level||"province";
  const scopeCity=scopeLevel==="local"?(scopeRegion?.canonical_city||""):scopeLevel==="city"||scopeLevel==="special_city"?(scopeRegion?.region_name||""):"";
  const peers=scopeCity?localList.filter(r=>r.canonical_city===scopeCity):cityList;
  if(kind==="funnel"){
    const steps=["basic.c026","basic.c027","basic.c004","basic.c003"].map(mid=>{const m=metric(mid);return{label:m?m.metric_name:mid,value:value(scopeId,year,mid)}});
    const grade=["basic.c005","basic.c004","basic.c003"].map(mid=>{const m=metric(mid);return{label:m?m.metric_name:mid,value:value(scopeId,year,mid)}});
    return <><Funnel steps={steps} colors={[palette[1],palette[2],palette[3],palette[4]]} onSelect={(name,v)=>onSelect({name,value:v,detail:"排查转化漏斗 · 逐级收窄"})}/><div className="insightDual"><span>隐患等级构成</span><Donut slices={grade} colors={["#4fb17d",PALETTE_RISK[2],PALETTE_RISK[4]]} size={96} thickness={14} center={fmt(grade.reduce((a,s)=>a+s.value,0))} sub="栋" onSelect={(name,v)=>onSelect({name,value:v,detail:"隐患等级 · 暂无/一般/重大"})}/></div></>;
  }
  if(kind==="stackedAge"){
    const ageMetrics=data.metrics.filter(m=>m.topic==="房屋基础信息"&&m.category==="建成年代");
    const rows=peers.map(c=>({name:c.region_name,values:ageMetrics.map(m=>value(c.region_id,year,m.metric_id))}));
    return <StackedBar rows={rows} segments={ageMetrics.map(m=>m.metric_name)} colors={AGE_COLORS} percent onSelect={(name,v)=>onSelect({name,value:v,detail:scopeCity?`${scopeCity} · 点击查看该区县构成`:"点击查看该地市各区县构成"})}/>;
  }
  if(kind==="heatmap"){
    const rows=KEY_TYPES.map(cat=>({cat,mid:(data.metrics.find(m=>m.topic==="房屋基础信息"&&m.category===cat&&m.metric_path.endsWith("重大安全隐患"))||{metric_id:""}).metric_id}));
    const values=rows.map(r=>peers.map(c=>value(c.region_id,year,r.mid)));
    const nonZero=values.flat().filter(v=>v>0).sort((a,b)=>a-b);
    const q=(p:number)=>nonZero[Math.min(nonZero.length-1,Math.floor((nonZero.length-1)*p))]||1;
    const cuts=[q(.2),q(.4),q(.6),q(.8)];
    const colorScale=(v:number)=>v<=0?"#f0f4f6":palette[v<=cuts[0]?0:v<=cuts[1]?1:v<=cuts[2]?2:v<=cuts[3]?3:4];
    return <Heatmap rows={rows.map(r=>r.cat)} cols={peers.map(c=>c.region_name)} values={values} colorScale={colorScale} onSelectCol={(city,row,v)=>onSelect({name:city,value:v,detail:`${row} · 重大安全隐患，点击查看${scopeCity||"该市"}各区县`})}/>;
  }
  if(kind==="stackedGovern"){
    const rows=KEY_TYPES.map(cat=>{
      const ms=data.metrics.filter(m=>m.topic==="安全隐患整治"&&m.category===cat);
      const s=(kw:string)=>ms.filter(m=>m.metric_path.includes(kw)).reduce((a,m)=>a+value(scopeId,year,m.metric_id),0);
      return{name:cat,values:[s("已整治"),s("整治中"),s("未整治")]};
    });
    return <StackedBar rows={rows} segments={["已整治","整治中","未整治"]} colors={GOVERN_COLORS} percent onSelect={(name,v)=>onSelect({name,value:v,detail:"整治状态 · 已整治/整治中/未整治"})}/>;
  }
  if(kind==="radar"){
    const entries=KEY_TYPES.map(cat=>{
      const m=data.metrics.find(x=>x.topic==="房屋基础信息"&&x.category==="排查情况"&&x.metric_path.startsWith(`排查情况 / ${cat}`));
      return{name:m?m.metric_name:cat,mid:m?m.metric_id:"",value:m?value(scopeId,year,m.metric_id):0};
    });
    // 参照基准：省=六类互比；市=全省各地市同类最大值；区县=该市下辖各区县同类最大值
    let maxes:number[]|undefined,sub="",name=scopeRegion?.region_name||"全省";
    const level=scopeRegion?.region_level||"province";
    if(level==="city"||level==="special_city"){
      maxes=entries.map(e=>Math.max(1,...cityList.map(c=>value(c.region_id,year,e.mid))));
      sub="各维度参照全省地市最高水平";
    }else if(level==="local"&&scopeRegion?.canonical_city){
      const peers=localList.filter(r=>r.canonical_city===scopeRegion.canonical_city);
      maxes=entries.map(e=>Math.max(1,...peers.map(p=>value(p.region_id,year,e.mid))));
      sub="各维度参照本市各区县最高水平";
    }else{
      maxes=entries.map(e=>Math.max(1,e.value));
      sub="全省六类规模对比";
    }
    return <Radar axes={entries.map(e=>e.name)} values={entries.map(e=>e.value)} maxes={maxes} color={palette[3]} title={`${name}六类重点房屋规模 · ${sub}`}/>;
  }
  if(kind==="treemap"){
    const cats=[...new Set(data.metrics.filter(m=>m.topic==="暂无隐患建筑潜在风险").map(m=>m.category))];
    const items=cats.map(cat=>{
      const ms=data.metrics.filter(m=>m.topic==="暂无隐患建筑潜在风险"&&m.category===cat);
      const total=ms.find(m=>m.metric_path.endsWith("总数"));
      const v=total?value(scopeId,year,total.metric_id):ms.reduce((a,m)=>a+value(scopeId,year,m.metric_id),0);
      return{name:cat.replace(/[（）()]/g,""),value:v};
    });
    const parts=data.metrics.filter(m=>m.topic==="暂无隐患建筑潜在风险"&&m.metric_path.includes("结构状况有变形损伤的房屋")&&m.metric_path.includes("/ 具体部位 /"));
    const partItems=parts.map(m=>({name:m.metric_path.split(" / ").pop()||m.metric_name,value:value(scopeId,year,m.metric_id)})).filter(p=>p.value>0);
    return <><Treemap items={items} colors={[...palette].reverse()} onSelect={(name,v)=>onSelect({name,value:v,detail:"潜在风险规模 · 面积代表数量"})}/>{partItems.length>1&&<div className="insightDual"><span>变形损伤部位（对数刻度）</span><LogBars items={partItems} color={palette[3]} onSelect={(name,v)=>onSelect({name,value:v,detail:"变形损伤部位 · 对数刻度"})}/></div>}</>;
  }
  return null;
}

function Bars({items,color="#58adde"}:{items:{name:string;value:number}[];color?:string}){const max=Math.max(...items.map(i=>i.value),1);return <div className="bars">{items.map((item,i)=><div key={`${item.name}-${i}`}><b>{String(i+1).padStart(2,"0")}</b><span title={item.name}>{item.name}</span><i><em style={{width:`${Math.sqrt(item.value/max)*100}%`,background:color}}/></i><strong>{fmt(item.value)}</strong></div>)}</div>}
function niceTicks(min:number,max:number,count=4):number[]{const span=Math.max(max-min,1),raw=span/count,mag=Math.pow(10,Math.floor(Math.log10(raw))),norm=raw/mag,step=(norm<=1?1:norm<=2?2:norm<=5?5:10)*mag,start=Math.floor(min/step)*step,ticks:number[]=[];for(let v=start;v<=max+step*.5;v+=step)ticks.push(v);return ticks}
function MiniLine({values,color="#4ca8d8"}:{values:number[];color?:string}){const rawMin=Math.min(...values),rawMax=Math.max(...values),ticks=niceTicks(rawMin,rawMax),tickMin=ticks[0],tickMax=ticks[ticks.length-1],span=Math.max(tickMax-tickMin,1),TOP=26,BOT=100,AX=54,X2=312,y=(v:number)=>BOT-(v-tickMin)/span*(BOT-TOP),px=(i:number)=>AX+8+i*((X2-AX-8)/(values.length-1||1));return <svg className="miniLine" viewBox="0 0 320 120">{ticks.map((t,i)=><g key={i}><line x1={AX} x2={X2} y1={y(t)} y2={y(t)} className="gridLine"/><text x={AX-5} y={y(t)+3} className="axisLabel" style={{textAnchor:"end"}}>{fmt(t)}</text></g>)}<polyline points={values.map((v,i)=>`${px(i)},${y(v)}`).join(" ")} style={{stroke:color}}/>{values.map((v,i)=><g key={i}><circle cx={px(i)} cy={y(v)} style={{stroke:color}}/><text x={px(i)} y="116">{2024+i}</text><text x={px(i)} y={y(v)-8}>{fmt(v)}</text></g>)}</svg>}

export default function Home(){
  const[data,setData]=useState<AnalyticsData|null>(null),[province,setProvince]=useState<GeoData|null>(null),[cities,setCities]=useState<GeoData|null>(null),[counties,setCounties]=useState<GeoData|null>(null),[zones,setZones]=useState<FunctionalZoneData|null>(null);
  const[year,setYear]=useState("2024"),[selectedCity,setSelectedCity]=useState(""),[selectedUnitKey,setSelectedUnitKey]=useState(""),[moduleId,setModuleId]=useState("overview"),[metricId,setMetricId]=useState("basic.c003"),[category,setCategory]=useState("排查结论"),[group,setGroup]=useState("核心指标"),[detailsOpen,setDetailsOpen]=useState(false),[uploadOpen,setUploadOpen]=useState(false),[insightSel,setInsightSel]=useState<{name:string;value:number;detail?:string}|null>(null);
  useEffect(()=>{Promise.all([fetch("/data/housing-analytics.json").then(r=>r.json()),fetch("/data/maps/fujian-province.json").then(r=>r.json()),fetch("/data/maps/fujian-regions.json").then(r=>r.json()),fetch("/data/maps/fujian-counties.json").then(r=>r.json()),fetch("/data/maps/fujian-functional-zones.json").then(r=>r.json())]).then(([a,p,c,co,z])=>{setData(a);setProvince(p);setCities(c);setCounties(co);setZones(z)})},[]);
  const active=MODULES.find(m=>m.id===moduleId)||MODULES[0];
  const moduleMetrics=useMemo(()=>data?.metrics.filter(m=>active.topics.includes(m.topic)&&(!active.categories.length||active.categories.includes(m.category)))||[],[data,active]);
  const categories=useMemo(()=>[...new Set(moduleMetrics.map(m=>m.category))],[moduleMetrics]);
  const categoryMetrics=moduleMetrics.filter(m=>m.category===category);
  const groups=[...new Set(categoryMetrics.map(metricGroup))];
  const filteredMetrics=categoryMetrics.filter(m=>metricGroup(m)===group);
  useEffect(()=>{const next=data?.metrics.find(m=>m.metric_id===active.defaultMetric);if(next){setMetricId(next.metric_id);setCategory(next.category);setGroup(metricGroup(next))}},[moduleId,data,active.defaultMetric]);
  if(!data||!province||!cities||!counties||!zones)return <div className="loading">正在加载完整房屋安全数据库…</div>;
  const metric=data.metrics.find(m=>m.metric_id===metricId)||moduleMetrics[0]||data.metrics[0];
  const regionById=Object.fromEntries(data.regions.map(r=>[r.region_id,r]));
  const value=(regionId:string,targetYear=year,targetMetric=metric.metric_id)=>data.values[targetYear]?.[regionId]?.[targetMetric]||0;
  const cityRegions=data.regions.filter(r=>r.region_level==="city"||r.region_level==="special_city");
  const localRegions=data.regions.filter(r=>r.region_level==="local");
  const selectedUnit=selectedUnitKey?localRegions.find(r=>`${r.canonical_city}|${r.region_name}`===selectedUnitKey):undefined;
  const selectedRegion=selectedUnit||(selectedCity?cityRegions.find(r=>r.region_name===selectedCity):regionById["350000"]);
  const scopeId=selectedRegion?.region_id||"350000";
  const cityValues=Object.fromEntries(cityRegions.map(r=>[r.region_name,value(r.region_id)]));
  const unitValues=Object.fromEntries(localRegions.map(r=>[`${r.canonical_city}|${r.region_name}`,value(r.region_id)]));
  const palette=valencePalette(metric);
  const cutsFor=(regions:RegionDef[])=>[.2,.4,.6,.8].map(q=>{const arr=regions.map(r=>value(r.region_id)).sort((a,b)=>a-b);return arr[Math.min(arr.length-1,Math.floor((arr.length-1)*q))]||0});
  const cityCuts=cutsFor(cityRegions),localCuts=cutsFor(localRegions);
  const rankingCity=selectedUnit?.canonical_city||selectedCity;
  const rankingRegions=rankingCity?localRegions.filter(r=>r.canonical_city===rankingCity):cityRegions;
  const rankingAll=rankingRegions.map(r=>({name:r.region_name,value:value(r.region_id)})).sort((a,b)=>b.value-a.value);
  const ranking=rankingAll;
  const topRanked=rankingAll[0];
  const trend=["2024","2025","2026"].map(y=>value(scopeId,y));
  const currentValue=value(scopeId),previous=value(scopeId,String(Number(year)-1)),change=year==="2024"?0:(currentValue-previous)/Math.max(1,previous);
  const scopeName=selectedUnit?.region_name||selectedCity||"全省";
  const panelTitle=active.panel.kind==="stackedAge"?`${scopeName} · 建成年代构成`:active.panel.kind==="heatmap"?`${scopeName} · 六类场所重大隐患`:active.panel.kind==="radar"?`${scopeName} · 六类重点房屋规模`:active.panel.kind==="funnel"?`${scopeName} · 排查转化漏斗`:active.panel.kind==="stackedGovern"?`${scopeName} · 整治状态构成`:active.panel.kind==="treemap"?`${scopeName} · 潜在风险规模`:active.panel.title;
  return <main>
    <header className="topbar"><div className="brand"><span>FUJIAN HOUSING SAFETY</span><h1>福建省房屋安全动态监测平台</h1><p>112 个区域 · 180 个指标 · 省市县多层级动态监测</p></div><div className="headerActions"><div className="status"><span><i/>完整数据库已连接</span><small>支持后续年度实际数据接入</small></div><button className="uploadEntry" onClick={()=>setUploadOpen(true)}>数据管理</button></div></header>
    <nav className="toolbar"><div>{MODULES.map(m=><button key={m.id} className={moduleId===m.id?"active":""} onClick={()=>setModuleId(m.id)}>{m.label}</button>)}</div><label>分类<select value={category} onChange={e=>{const nextCategory=e.target.value,first=moduleMetrics.find(m=>m.category===nextCategory);setCategory(nextCategory);if(first){setGroup(metricGroup(first));setMetricId(first.metric_id)}}}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>{groups.length>1&&<label>层级<select value={group} onChange={e=>{const nextGroup=e.target.value,first=categoryMetrics.find(m=>metricGroup(m)===nextGroup);setGroup(nextGroup);if(first)setMetricId(first.metric_id)}}>{groups.map(item=><option key={item}>{item}</option>)}</select></label>}<label>核心指标<select value={metric.metric_id} onChange={e=>setMetricId(e.target.value)}>{filteredMetrics.map(m=><option value={m.metric_id} key={m.metric_id}>{m.metric_name}</option>)}</select></label><label>年度<select value={year} onChange={e=>setYear(e.target.value)}><option value="2024">2024 实际</option><option value="2025">2025 模拟</option><option value="2026">2026 模拟</option></select></label><span className={year==="2024"?"actualTag":"simulationTag"}>{year==="2024"?"实际":"模拟 ±5%"}</span></nav>
    <section className="kpis"><article><span>{metric.metric_name}</span><strong>{fmt(currentValue)}</strong><small>栋 · {scopeName}</small></article><article><span>年度变化</span><strong>{year==="2024"?"基准年":`${change>=0?"+":""}${fmt(change*100,2)}%`}</strong><small>{year==="2024"?"当前实际数据":"相对上一年度"}</small></article><article><span>当前指标最高</span><strong>{topRanked?topRanked.name:"—"}</strong><small>{topRanked?`${fmt(topRanked.value)} 栋 · ${metricValence(metric)==="negative"?"需重点关注":"数值最高"}`:""}</small></article><article className="reportKpi"><span>分析专题</span><strong>{active.scope}</strong><small>{active.chartTitle}</small></article></section>
    <section className="dashboard"><aside className="side left"><section className="panel rankPanel"><div className="panelHead"><div><span>REGIONAL RANKING</span><h2>{selectedUnit?`${selectedUnit.canonical_city}区县排名`:selectedCity?`${selectedCity}区县排名`:`地市排名`} · {metric.metric_name} · 共{rankingAll.length}</h2>{metricValence(metric)==="negative"&&<small className="rankWarning">数值越高隐患越重</small>}</div></div><div className="rankScroll"><Bars items={ranking} color={palette[Math.min(3,palette.length-1)]}/></div></section><section className="panel"><div className="panelHead"><div><span>YEAR TREND</span><h2>{scopeName} · {metric.metric_name} · 年度趋势</h2></div></div><div className="miniLineWrap"><MiniLine values={trend} color={palette[3]}/></div><p className="note">2025、2026 为 ±5% 功能测试数据</p></section></aside>
      <MapPanel provinceFeatures={province.features} cityFeatures={cities.features} countyFeatures={counties.features} functionalZones={zones.features} cityValues={cityValues} unitValues={unitValues} metricName={metric.metric_name} selectedCity={selectedCity} selectedUnitKey={selectedUnitKey} palette={palette} cityCuts={cityCuts} localCuts={localCuts} onSelectCity={name=>{setSelectedCity(name);setSelectedUnitKey("");setDetailsOpen(false)}} onSelectUnit={key=>{setSelectedUnitKey(key);setDetailsOpen(false)}} onOpenDetails={()=>setDetailsOpen(true)} onBack={()=>{setDetailsOpen(false);if(selectedUnitKey)setSelectedUnitKey("");else setSelectedCity("")}}/>
      <aside className="side right"><section className="panel insight"><div className="panelHead"><div><span>MODULE INSIGHT</span><h2>{panelTitle}</h2><small>{active.panel.sub}</small></div></div><div className="insightBody"><ModuleInsight kind={active.panel.kind} data={data} regions={data.regions} scopeId={scopeId} year={year} value={value} palette={palette} onSelect={item=>setInsightSel(item)}/></div></section><section className="panel compact"><div className="panelHead"><div><span>ANALYSIS FOCUS</span><h2>{active.scope} · 展示重点<span className="presetTag">预设</span></h2></div></div><div className="reportFindings">{active.focus.map((item,index)=><article key={item}><b>{String(index+1).padStart(2,"0")}</b><p>{item}</p></article>)}</div></section></aside>
    </section><footer><span>当前指标：{metric.metric_path} · 本专题 {moduleMetrics.length} 项指标 · 数据单位：栋</span><span>功能区为近似点位；模拟年份将在实际数据接入后自动替换</span></footer>
    {insightSel&&(()=>{
      const isCity=Boolean(cityRegions.find(r=>r.region_name===insightSel.name));
      const countyRows=localRegions.filter(r=>r.canonical_city===insightSel.name).map(r=>({name:r.region_name,regionId:r.region_id,value:value(r.region_id)})).sort((a,b)=>b.value-a.value);
      return <div className="detailBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setInsightSel(null)}}><section className="detailDrawer insightDrawer">
        <header><div><span>INSIGHT DETAIL</span><h2>{insightSel.name}</h2><p>{insightSel.detail}{isCity?` · 下辖 ${countyRows.length} 个区县/功能区`:""}</p></div><button onClick={()=>setInsightSel(null)}>×</button></header>
        <div className="detailBody">
          {isCity&&countyRows.length>0
            ? <section><h3>{insightSel.name} · 各区县{metric.metric_name}<small>{year} 年</small></h3><div>{countyRows.map(r=><article key={r.name}><span title={r.name}>{r.name}</span><strong>{fmt(r.value)}</strong><small>栋</small><em>{fmt(value(r.regionId,"2024"))} / {fmt(value(r.regionId,"2025"))} / {fmt(value(r.regionId,"2026"))}</em></article>)}</div></section>
            : <section><h3>{metric.metric_name}<small>{scopeName} · {year} 年</small></h3><div><article><span>当前值</span><strong>{fmt(insightSel.value)}</strong><small>栋</small><em>2024 / 2025 / 2026：{fmt(value(scopeId,"2024"))} / {fmt(value(scopeId,"2025"))} / {fmt(value(scopeId,"2026"))}</em></article></div></section>}
        </div>
        <footer><span>点击地图可继续下钻</span><span>数据单位：栋</span></footer>
      </section></div>;
    })()}
    {detailsOpen&&selectedRegion&&<div className="detailBackdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDetailsOpen(false)}}><section className="detailDrawer"><header><div><span>REGION DETAIL</span><h2>{scopeName} · {active.label}</h2><p>{selectedUnit?`${selectedUnit.canonical_city} · 区县/功能区独立统计`:selectedCity?"地市级汇总数据":"省级汇总数据"}</p></div><button onClick={()=>setDetailsOpen(false)}>×</button></header><div className="detailBody">{categories.map(cat=>{const items=moduleMetrics.filter(m=>m.category===cat);return <section key={cat}><h3>{cat}<small>{items.length} 项</small></h3><div>{items.map(item=><article key={item.metric_id}><span title={item.metric_path}>{item.metric_path.replace(`${cat} / `,"")}</span><strong>{fmt(value(scopeId,year,item.metric_id))}</strong><small>栋</small><em>{fmt(value(scopeId,"2024",item.metric_id))} / {fmt(value(scopeId,"2025",item.metric_id))} / {fmt(value(scopeId,"2026",item.metric_id))}</em><button onClick={()=>{setCategory(item.category);setGroup(metricGroup(item));setMetricId(item.metric_id);setDetailsOpen(false)}}>用于地图</button></article>)}</div></section>})}</div><footer><span>行内三年值：2024 / 2025 / 2026</span><span>点击“用于地图”可切换主界面分析口径</span></footer></section></div>}
    {uploadOpen&&<DataIntakeDialog onClose={()=>setUploadOpen(false)}/>}
  </main>;
}

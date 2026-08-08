"use client";

// 通用可视化组件库（手绘 SVG / 原生 div，零依赖）
// 用于各模块的专属图表：堆叠条、环形、热力图、雷达、漏斗、矩形树图、对数条。

const fmt=(value:number,digits=0)=>new Intl.NumberFormat("zh-CN",{useGrouping:false,maximumFractionDigits:digits}).format(value||0);
/** 根据背景色亮度返回可读文字色：浅底深字、深底白字 */
const textOn=(bg:string)=>{const m=bg.replace("#","");if(m.length<6)return"#15334e";const r=parseInt(m.slice(0,2),16),g=parseInt(m.slice(2,4),16),b=parseInt(m.slice(4,6),16);return(r*299+g*587+b*114)/255000>0.55?"#15334e":"#ffffff"};

/** 堆叠横条：rows 每行一组 segments 值；percent=true 时按占比 100% 堆叠 */
export function StackedBar({rows,segments,colors,percent=false,onSelect}:{rows:{name:string;values:number[]}[];segments:string[];colors:string[];percent?:boolean;onSelect?:(name:string,total:number)=>void}){
  const totals=rows.map(r=>r.values.reduce((a,b)=>a+b,0));
  const maxTotal=Math.max(...totals,1);
  return <div className="stackWrap">{rows.map((r,i)=>{const t=Math.max(totals[i],1);return <div className="stackRow" key={r.name} onClick={()=>onSelect?.(r.name,t)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")onSelect?.(r.name,t)}}><span className="stackName" title={r.name}>{r.name}</span><div className="stackTrack">{r.values.map((v,j)=>v>0?<i key={j} style={{width:`${percent?v/t*100:v/maxTotal*100}%`,background:colors[j%colors.length]}} title={`${segments[j]} ${fmt(v)}`}/>:null)}</div><strong title={`合计 ${fmt(t)}`}>{percent?`${Math.round(t)}`:fmt(t)}</strong></div>})}</div>;
}

/** 环形图：slices 占比；center/sub 为圆心文案 */
export function Donut({slices,colors,size=120,thickness=16,center,sub,onSelect}:{slices:{label:string;value:number}[];colors:string[];size?:number;thickness?:number;center?:string;sub?:string;onSelect?:(label:string,value:number)=>void}){
  const total=Math.max(slices.reduce((a,s)=>a+s.value,0),1);
  const r=(size-thickness)/2,cx=size/2,cy=size/2,C=2*Math.PI*r;
  let acc=0;
  return <div className="donutWrap"><svg className="donut" viewBox={`0 0 ${size} ${size}`} width={size} height={size}>{slices.map((s,i)=>{const frac=s.value/total,dash=`${frac*C} ${C-frac*C}`,off=-acc*C;acc+=frac;return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={colors[i%colors.length]} strokeWidth={thickness} strokeDasharray={dash} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`} onClick={()=>onSelect?.(s.label,s.value)} style={{cursor:onSelect?"pointer":undefined}}/>})}</svg>{center&&<div className="donutCenter"><b>{center}</b>{sub&&<small>{sub}</small>}</div>}</div>;
}

/** 热力图矩阵：values[row][col]，colorScale(v) 返回颜色；点击列（地市）可下钻 */
export function Heatmap({rows,cols,values,colorScale,onSelectCol}:{rows:string[];cols:string[];values:number[][];colorScale:(v:number)=>string;onSelectCol?:(col:string,row:string,v:number)=>void}){
  const colsCss=`minmax(56px,84px) repeat(${cols.length},minmax(0,1fr))`;
  return <div className="heatWrap"><div className="heatHead" style={{gridTemplateColumns:colsCss}}><span/>{cols.map(c=><b key={c} title={c}>{c}</b>)}</div>{rows.map((r,ri)=><div className="heatRow" key={r} style={{gridTemplateColumns:colsCss}}><span title={r}>{r}</span>{cols.map((c,ci)=>{const v=values[ri]?.[ci]||0;return <i key={c} className={v<=0?"heatCell zero":"heatCell"} style={{background:colorScale(v)}} title={`${r} · ${c}：${fmt(v)} 栋`} onClick={()=>onSelectCol?.(c,r,v)}>{v<=0?<em/>:null}</i>})}</div>)}</div>;
}

/** 雷达图：axes 维度名 + values；值按 sqrt 压缩避免偏态把其余维度压没；标签按象限分侧对齐 */
export function Radar({axes,values,color="#58adde",size=240,title,maxes}:{axes:string[];values:number[];color?:string;size?:number;title?:string;maxes?:number[]}){
  const cx=size/2,cy=size/2,R=size/2-50,maxV=Math.max(...values,1);
  const angle=(i:number)=>-Math.PI/2+i*2*Math.PI/axes.length;
  const base=(i:number)=>(maxes&&maxes[i]>0?maxes[i]:maxV)||1;
  const pt=(i:number,v:number)=>{const a=angle(i),r=R*Math.sqrt(Math.max(0,v)/base(i));return[cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  const lp=(i:number)=>{const a=angle(i),r=R*1.14;return[cx+r*Math.cos(a),cy+r*Math.sin(a)]};
  const rings=[.25,.5,.75,1].map(f=>axes.map((_,i)=>{const a=angle(i);return[cx+R*f*Math.cos(a),cy+R*f*Math.sin(a)]}));
  const poly=axes.map((_,i)=>pt(i,values[i]||0).join(",")).join(" ");
  return <div className="radarWrap">{title&&<div className="radarTitle">{title}</div>}<svg className="radar" viewBox={`0 0 ${size} ${size}`}>{rings.map((ring,i)=><polygon key={i} points={ring.map(p=>p.join(",")).join(" ")} className="radarRing"/>)}{axes.map((_,i)=>{const a=angle(i);return<line key={i} x1={cx} y1={cy} x2={cx+R*Math.cos(a)} y2={cy+R*Math.sin(a)} className="radarAxis"/>})}<polygon points={poly} className="radarArea" style={{fill:`${color}2e`,stroke:color}}/>{values.map((v,i)=>{const[x,y]=pt(i,v);return<circle key={i} cx={x} cy={y} r={3} style={{fill:color}}/>})}{axes.map((a,i)=>{const[lx,ly]=lp(i),anc=lx<cx-8?"end":lx>cx+8?"start":"middle";return<text key={i} x={lx} y={ly+3} className="radarLabel" textAnchor={anc}>{a}</text>})}</svg></div>;
}

/** 漏斗：steps 自上而下逐级收窄 */
export function Funnel({steps,colors,onSelect}:{steps:{label:string;value:number}[];colors?:string[];onSelect?:(label:string,value:number)=>void}){
  const max=Math.max(...steps.map(s=>s.value),1);
  return <div className="funnel">{steps.map((s,i)=>{const bg=colors?colors[i%colors.length]:"#8dcef0",w=Math.max(16,s.value/max*100);return<div key={i} className="funnelStep" style={{width:`${w}%`,background:bg,color:textOn(bg)}} onClick={()=>onSelect?.(s.label,s.value)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")onSelect?.(s.label,s.value)}}><span>{s.label}</span><b>{fmt(s.value)}</b></div>})}</div>;
}

/** 矩形树图：两列网格，行高按 sqrt 面积编码（适合偏态规模） */
export function Treemap({items,colors,onSelect}:{items:{name:string;value:number}[];colors?:string[];onSelect?:()=>void}){
  const max=Math.max(...items.map(i=>i.value),1);
  return <div className="treeWrap">{[...items].sort((a,b)=>b.value-a.value).map((it,i)=>{const bg=colors?colors[i%colors.length]:"#8dcef0";return <button key={it.name} className="treeTile" style={{minHeight:`${Math.max(38,Math.round(64*Math.sqrt(it.value/max)))}px`,background:bg,color:textOn(bg)}} title={`${it.name}：${fmt(it.value)} 栋`} onClick={onSelect}><b>{it.name}</b><small>{fmt(it.value)}</small></button>})}</div>;
}

/** 对数刻度条形（极偏数据用，1 起对数避免 log(0)） */
export function LogBars({items,color="#58adde",onSelect}:{items:{name:string;value:number}[];color?:string;onSelect?:(name:string,value:number)=>void}){
  const max=Math.max(...items.map(i=>Math.log10(i.value+1)),1);
  return <div className="bars">{items.map((item,i)=><div key={`${item.name}-${i}`} onClick={()=>onSelect?.(item.name,item.value)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")onSelect?.(item.name,item.value)}}><b>{String(i+1).padStart(2,"0")}</b><span title={item.name}>{item.name}</span><i><em style={{width:`${Math.log10(item.value+1)/max*100}%`,background:color}}/></i><strong>{fmt(item.value)}</strong></div>)}</div>;
}

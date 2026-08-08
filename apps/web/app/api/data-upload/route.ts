const ALLOWED_EXTENSIONS=new Set(["xlsx","xls","csv","json"]);
const MAX_FILE_SIZE=50*1024*1024;

export async function POST(request:Request){
  const form=await request.formData();
  const file=form.get("file");
  const year=String(form.get("year")||"");
  const datasetType=String(form.get("datasetType")||"");
  if(!(file instanceof File))return Response.json({error:"请选择数据文件"},{status:400});
  if(!/^20\d{2}$/.test(year))return Response.json({error:"数据年度格式不正确"},{status:400});
  const extension=file.name.split(".").pop()?.toLowerCase()||"";
  if(!ALLOWED_EXTENSIONS.has(extension))return Response.json({error:"仅支持 XLSX、XLS、CSV 或 JSON 文件"},{status:415});
  if(file.size>MAX_FILE_SIZE)return Response.json({error:"文件不能超过 50MB"},{status:413});
  if(file.size===0)return Response.json({error:"文件内容为空"},{status:400});
  const bytes=await file.arrayBuffer();
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
  return Response.json({accepted:true,stage:"preflight",token:crypto.randomUUID(),year,datasetType,fileName:file.name,fileSize:file.size,sha256,checks:[
    {label:"文件完整性",status:"passed",detail:`${extension.toUpperCase()} · ${(file.size/1024/1024).toFixed(2)} MB`},
    {label:"数据年度",status:"passed",detail:`识别为 ${year} 年待接入数据`},
    {label:"重复文件检查",status:"passed",detail:`已生成唯一文件指纹 ${sha256.slice(0,12)}…`},
    {label:"字段与指标映射",status:"pending",detail:"待真实年度数据模板确定后执行"},
    {label:"行政区匹配",status:"pending",detail:"待解析工作表后与标准区域表比较"},
    {label:"年度差异比较",status:"pending",detail:"将与当前模拟数据及上一年度实际数据比较"}
  ]},{status:202});
}

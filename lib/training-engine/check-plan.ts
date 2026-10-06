import { buildPlan } from "./plan-builder";
import { validatePlan } from "./plan-validator";
const L = (lo:number|null,hi:number|null,mx:number|null=null)=>({intensityPctFtpLow:lo,intensityPctFtpHigh:hi,maxSessionsPerWeek:mx});
const library:any = { z2:L(56,75), sweet_spot:L(88,94), umbral:L(95,105,2), hiit_genuino:L(108,115,1), ronnestad_30_15:L(125,135), z2_sprints:L(null,null), billat_30_30:L(110,116), rst:L(150,180), gym:L(null,null) };
const T=(d:number,s:string,q:boolean,m:number|null)=>({dayOfWeek:d,stimulusType:s,isQualityDay:q,targetDurationMin:m});
const templates:Record<string,any[]> = {
  user: [T(1,"cycling",true,60),T(2,"cycling",false,120),T(3,"gym",false,90),T(4,"cycling",true,120),T(5,"gym",false,90),T(6,"cycling",false,180),T(0,"cycling",false,240)],
  twoQ: [T(2,"cycling",true,75),T(4,"cycling",true,75),T(6,"cycling",false,150),T(0,"cycling",false,120),T(1,"rest",false,0)],
  threeQ: [T(1,"cycling",true,60),T(3,"cycling",true,60),T(5,"cycling",true,60),T(0,"cycling",false,150)],
  consecutive: [T(1,"cycling",true,60),T(2,"cycling",true,60),T(4,"cycling",false,90),T(6,"cycling",false,120)],
  oneQ: [T(3,"cycling",true,60),T(6,"cycling",false,180)],
};
let bad=0, n=0;
for (const objective of ["vo2max","umbral","base","tapering"])
for (const [tn,tpl] of Object.entries(templates))
for (const ratio of ["3:1","4:1"])
for (const weeks of [4,6,8,12])
for (const ftpP of [undefined,"20min","8min","5min"])
for (const startDow of [0,3,6]) {
  const start = new Date(Date.UTC(2026,9,3+((startDow-6+7)%7),20,12,10)); // Oct 3 2026 is Saturday(6)
  const end = new Date(start.getTime()+weeks*7*86400000);
  const plan = buildPlan({block:{name:"t",objective,startDate:start,endDate:end},ftp:300,pvo2maxWatts:ftpP==="5min"?380:null,thresholds:{deloadRatio:ratio,weeksBetweenFtpTest:5,ftpTestProtocol:ftpP},template:tpl,library});
  const w = validatePlan(plan,{objective,ftp:300,pvo2maxWatts:ftpP==="5min"?380:null}).filter((x) => !x.startsWith("INFO")); n++;
  if (w.length){ bad++; if(bad<=15) console.log(objective,tn,ratio,weeks,ftpP,startDow,"\n  "+[...new Set(w)].slice(0,4).join("\n  ")); }
}
console.log({scenarios:n,withWarnings:bad});

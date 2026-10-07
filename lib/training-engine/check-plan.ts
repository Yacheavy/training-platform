import { buildPlan } from "./plan-builder";
import { validatePlan } from "./plan-validator";
const L = (lo:number|null,hi:number|null,mx:number|null=null)=>({intensityPctFtpLow:lo,intensityPctFtpHigh:hi,maxSessionsPerWeek:mx});
const library:any = { z2:L(56,75), sweet_spot:L(88,94), umbral:L(95,105,2), hiit_genuino:L(108,115,1), ronnestad_30_15:L(125,135), z2_sprints:L(null,null), billat_30_30:L(110,116), rst:L(150,180), gym:L(null,null), z2_progressive:L(56,75), endurance_tempo:L(78,86,2), over_under:L(92,106,1), vo2_long:L(108,115,1), sprint_neuro:L(null,null,1), long_durability:L(84,90,1), torque_low_cadence:L(70,76,1) };
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
for (const startDow of [0,3,6])
for (const vo2Stimulus of [undefined,"ronnestad_30_15","alternate","rotate"])
for (const level of ["conservative","balanced","varied"]) {
  const banned = level === "varied" && vo2Stimulus === "rotate" ? ["sprint_neuro","torque_low_cadence"] : [];
  const start = new Date(Date.UTC(2026,9,3+((startDow-6+7)%7),20,12,10)); // Oct 3 2026 is Saturday(6)
  const end = new Date(start.getTime()+weeks*7*86400000);
  const plan = buildPlan({block:{name:"t",objective,startDate:start,endDate:end},ftp:300,pvo2maxWatts:ftpP==="5min"?380:null,thresholds:{deloadRatio:ratio,weeksBetweenFtpTest:5,ftpTestProtocol:ftpP,vo2Stimulus,varietyLevel:level,bannedStimuli:banned},template:tpl,library});
  const w = validatePlan(plan,{objective,ftp:300,pvo2maxWatts:ftpP==="5min"?380:null,banned}).filter((x) => !x.startsWith("INFO")); n++;
  if (w.length){ bad++; if(bad<=15) console.log(objective,tn,ratio,weeks,ftpP,startDow,level,vo2Stimulus,"\n  "+[...new Set(w)].slice(0,4).join("\n  ")); }
}
console.log({scenarios:n,withWarnings:bad});

// Variedad: en un plan largo, nivel equilibrado/variado debe usar varias variantes; conservador casi no varía
for (const objective of ["vo2max","umbral","base"]) for (const level of ["conservative","balanced","varied"]) {
  const start = new Date(Date.UTC(2026,9,5,12,0,0)); const end = new Date(start.getTime()+12*7*86400000);
  const plan = buildPlan({block:{name:"t",objective,startDate:start,endDate:end},ftp:300,pvo2maxWatts:380,thresholds:{deloadRatio:"3:1",weeksBetweenFtpTest:5,ftpTestProtocol:"20min",vo2Stimulus:null,varietyLevel:level},template:templates.user,library});
  const keys = new Map<string,number>(); for (const d of plan) if (d.stimulusType!=="gym") keys.set(d.stimulusType,(keys.get(d.stimulusType)??0)+1);
  console.log(objective.padEnd(7), level.padEnd(12), keys.size, "variantes:", [...keys.entries()].map(([k,v])=>k+":"+v).join(" "));
  if (level!=="conservative" && keys.size<5) { console.log("  FALTA VARIEDAD"); bad++; }
}
if (bad) process.exitCode = 1;

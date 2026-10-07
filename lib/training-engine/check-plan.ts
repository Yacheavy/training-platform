import { buildPlan } from "./plan-builder";
import { validatePlan } from "./plan-validator";
import { proposeSeason, pickPrimaryGoal } from "./season-planner";
import { progressionAdjustments, intensityGuard, type ExecutionRecord } from "./autoregulation";
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

// Autorregulación: reglas puras
const R = (key:string, at:number, tssRatio:number|null, deviation:any="NONE", decouplingPct:number|null=null):ExecutionRecord => ({key,at,tssRatio,deviation,decouplingPct});
const chk = (name:string, ok:boolean) => { if(!ok){ console.log("FALLA autorregulación:",name); bad++; } };
chk("2 cortas → -1", progressionAdjustments([R("umbral",1,0.7),R("umbral",2,0.75)]).umbral.adjust === -1);
chk("3 buenas → +1", progressionAdjustments([R("umbral",1,1),R("umbral",2,0.95),R("umbral",3,1.05)]).umbral.adjust === 1);
chk("1 sola → 0", progressionAdjustments([R("umbral",1,0.5)]).umbral.adjust === 0);
chk("mixtas → 0", progressionAdjustments([R("umbral",1,0.7),R("umbral",2,1)]).umbral.adjust === 0);
chk("desacople alto en continua impide +1", progressionAdjustments([R("sweet_spot",1,1,"NONE",9),R("sweet_spot",2,1),R("sweet_spot",3,1)]).sweet_spot.adjust === 0);
chk("más duras con desacople >10 dos veces → -1", progressionAdjustments([R("z2",1,1.3,"HARDER_THAN_PLANNED",12),R("z2",2,1.3,"HARDER_THAN_PLANNED",11)]).z2.adjust === -1);
chk("guard alto", intensityGuard({lowH:6,midH:1,highH:3})?.dropSecondary === true);
chk("guard gris", intensityGuard({lowH:6,midH:4,highH:0.3})?.avoidMid === true);
chk("guard sin datos", intensityGuard({lowH:2,midH:1,highH:0.5}) === null);
chk("guard ok", intensityGuard({lowH:8,midH:1,highH:1.5}) === null);

// Con ajustes y guard activos el plan sigue sin advertencias
for (const objective of ["vo2max","umbral","base"]) for (const adjust of [-1,1]) for (const g of [{dropSecondary:true,avoidMid:false},{dropSecondary:false,avoidMid:true},{dropSecondary:true,avoidMid:true}]) for (const tn of Object.keys(templates)) {
  const start = new Date(Date.UTC(2026,9,5,12,0,0)); const end = new Date(start.getTime()+10*7*86400000);
  const execution:any = Object.fromEntries(["hiit_genuino","sweet_spot","umbral","vo2_long","over_under","endurance_tempo","long_durability","ronnestad_30_15","z2_sprints","sprint_neuro"].map(k=>[k,{adjust:adjust,reason:"test"}]));
  const plan = buildPlan({block:{name:"t",objective,startDate:start,endDate:end},ftp:300,pvo2maxWatts:380,thresholds:{deloadRatio:"3:1",weeksBetweenFtpTest:5,ftpTestProtocol:"20min",vo2Stimulus:"rotate",varietyLevel:"varied"},template:templates[tn],library,execution,guard:{...g,days:14,reason:"test"},guardUntilOffset:14});
  const w = validatePlan(plan,{objective,ftp:300,pvo2maxWatts:380}).filter((x)=>!x.startsWith("INFO")); n++;
  if (w.length){ bad++; console.log("AUTO",objective,tn,adjust,JSON.stringify(g),"\n  "+[...new Set(w)].slice(0,3).join("\n  ")); }
  // el guard debe sacar lo que promete en los primeros 14 días
  const early = plan.filter((d)=>d.dayOffset<=14);
  if (g.dropSecondary && early.some((d)=>d.role==="secondary")) { bad++; console.log("guard dropSecondary no aplicado",objective,tn); }
  if (g.avoidMid && early.some((d)=>d.role!=="primary" && ["endurance_tempo","sweet_spot","over_under"].includes(d.stimulusType))) { bad++; console.log("guard avoidMid no aplicado",objective,tn); }
}

// Periodización por bloques (semana intensificada): sin advertencias y con 2 sesiones de VO2max en esas semanas
for (const tn of Object.keys(templates)) for (const ratio of ["3:1","4:1"]) for (const vo2Stimulus of [null,"hiit_genuino","rotate","ronnestad_30_15"]) for (const weeks of [8,12]) for (const ftpP of ["20min","8min"]) {
  const start = new Date(Date.UTC(2026,9,3,12,0,0)); const end = new Date(start.getTime()+weeks*7*86400000);
  const plan = buildPlan({block:{name:"t",objective:"vo2max",startDate:start,endDate:end},ftp:300,pvo2maxWatts:380,thresholds:{deloadRatio:ratio,weeksBetweenFtpTest:5,ftpTestProtocol:ftpP,vo2Stimulus,varietyLevel:"balanced",periodization:"block"},template:templates[tn],library});
  const w = validatePlan(plan,{objective:"vo2max",ftp:300,pvo2maxWatts:380}).filter((x)=>!x.startsWith("INFO")); n++;
  if (w.length){ bad++; console.log("BLOQUE",tn,ratio,weeks,vo2Stimulus,"\n  "+[...new Set(w)].slice(0,3).join("\n  ")); }
  const twoQ = templates[tn].filter((t:any)=>t.stimulusType==="cycling"&&t.isQualityDay).length>=2;
  const intens = new Set(plan.filter((d)=>d.intensified).map((d)=>d.weekIndex));
  if (twoQ && intens.size===0) { bad++; console.log("BLOQUE sin semana intensificada",tn,ratio,weeks); }
}
const bs = new Date(Date.UTC(2026,9,5,12,0,0));
const bp = buildPlan({block:{name:"t",objective:"vo2max",startDate:bs,endDate:new Date(bs.getTime()+12*7*86400000)},ftp:300,pvo2maxWatts:380,thresholds:{deloadRatio:"3:1",weeksBetweenFtpTest:0,ftpTestProtocol:"20min",vo2Stimulus:"rotate",varietyLevel:"balanced",periodization:"block"},template:templates.user,library});
const vo2PerWeek = new Map<number,number>(); for (const d of bp) if (["hiit_genuino","ronnestad_30_15","vo2_long"].includes(d.stimulusType) && !d.isDeload) vo2PerWeek.set(d.weekIndex,(vo2PerWeek.get(d.weekIndex)??0)+1);
console.log("VO2max por semana (bloques, plantilla del usuario):",[...vo2PerWeek.entries()].map(([k,v])=>`s${k+1}:${v}`).join(" "));
for (const [wk,c] of vo2PerWeek) { const exp = bp.some((d)=>d.weekIndex===wk&&d.intensified)?2:1; if (c!==exp) { bad++; console.log("BLOQUE: semana",wk+1,"tiene",c,"VO2max, esperado",exp); } }

// Planificador de temporada
{
  const check = (name:string, ok:boolean) => { if(!ok){ console.log("FALLA temporada:",name); bad++; } };
  const ftpGoal = { name:"FTP 320", type:"PERFORMANCE" as const, dateKey:"2027-01-01", metric:"FTP" };
  const user = proposeSeason({ todayKey:"2026-10-07", goal:ftpGoal, existing:[{objective:"vo2max",startKey:"2026-10-03",endKey:"2026-11-28"}] });
  console.log("Temporada (usuario):", user.blocks.map(b=>`${b.objective} ${b.startKey}→${b.endKey} (${b.weeks}s)`).join(" | "));
  check("usuario: 1 bloque de umbral hasta 1/1", user.blocks.length===1 && user.blocks[0].objective==="umbral" && user.blocks[0].startKey==="2026-11-28" && user.blocks[0].endKey==="2027-01-01");
  const none = proposeSeason({ todayKey:"2026-10-07", goal:ftpGoal, existing:[{objective:"umbral",startKey:"2026-10-03",endKey:"2027-01-01"}] });
  check("cubierto", none.covered && none.blocks.length===0);
  check("sin objetivo", proposeSeason({todayKey:"2026-10-07",goal:null,existing:[]}).covered);
  const race = proposeSeason({ todayKey:"2026-10-07", goal:{name:"Carrera",type:"EVENT",dateKey:"2027-02-28"}, existing:[] });
  console.log("Temporada (carrera, sin bloques):", race.blocks.map(b=>`${b.objective} ${b.startKey}→${b.endKey} (${b.weeks}s)`).join(" | "));
  check("carrera: termina en taper en la fecha", race.blocks.length>=3 && race.blocks[race.blocks.length-1].objective==="tapering" && race.blocks[race.blocks.length-1].endKey==="2027-02-28");
  // Continuidad, sin huecos ni superposiciones, y todos los bloques con ≥3 semanas salvo el taper
  for (const [today,date,type,existing] of [["2026-10-07","2027-02-28","EVENT",[]],["2026-10-07","2027-06-01","EVENT",[]],["2026-10-07","2026-12-20","EVENT",[]],["2026-10-07","2027-01-01","PERFORMANCE",[]],["2026-10-07","2027-04-01","PERFORMANCE",[{objective:"base",startKey:"2026-10-03",endKey:"2026-11-14"}]],["2026-10-07","2027-03-01","EVENT",[{objective:"vo2max",startKey:"2026-10-03",endKey:"2026-12-01"}]]] as any[]) {
    const p = proposeSeason({ todayKey:today, goal:{name:"x",type,dateKey:date}, existing });
    let prev = existing.length ? existing[existing.length-1].endKey : today;
    for (const b of p.blocks) {
      if (b.startKey!==prev) { check(`hueco/superposición ${type} ${date} ${b.startKey}≠${prev}`,false); }
      if (b.objective!=="tapering" && b.weeks<3) check(`bloque corto ${type} ${date} ${b.objective} ${b.weeks}s`,false);
      if (b.endKey<=b.startKey) check("bloque vacío",false);
      prev = b.endKey;
    }
    if (p.blocks.length && prev!==date) check(`no llega a la fecha ${type} ${date} (termina ${prev})`,false);
  }
  const g = pickPrimaryGoal([{priority:"B",dateKey:"2026-12-01"},{priority:"A",dateKey:"2027-03-01"},{priority:"A",dateKey:"2026-11-01"},{priority:"A",dateKey:"2026-01-01"}],"2026-10-07");
  check("objetivo principal: A más cercano futuro", g?.dateKey==="2026-11-01");
}
console.log({scenariosTotal:n,withProblems:bad});
if (bad) process.exitCode = 1;

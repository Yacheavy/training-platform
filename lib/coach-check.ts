/** Reglas de acceso del entrenador a sus alumnos. Corre con: npx tsx lib/coach-check.ts */
import { coachCanManage } from "./access";

let checks = 0;
const problems: string[] = [];
const ok = (c: boolean, m: string) => { checks++; if (!c) problems.push(m); };

const stu = { id: "s1", role: "ATHLETE" };
ok(coachCanManage({ coachId: "c1", student: stu, invite: { invitedById: "c1" } }), "su propio alumno debe poder gestionarse");
ok(coachCanManage({ coachId: "c1", student: stu, invite: { invitedById: null } }), "invitación antigua sin dueño debe poder gestionarse");
ok(!coachCanManage({ coachId: "c1", student: stu, invite: { invitedById: "c2" } }), "alumno de otro coach no debe poder gestionarse");
ok(!coachCanManage({ coachId: "c1", student: stu, invite: null }), "sin invitación no debe poder gestionarse");
ok(!coachCanManage({ coachId: "c1", student: null, invite: { invitedById: "c1" } }), "alumno inexistente");
ok(!coachCanManage({ coachId: "c1", student: { id: "c2", role: "COACH" }, invite: { invitedById: "c1" } }), "otro coach no es un alumno");
ok(!coachCanManage({ coachId: "c1", student: { id: "c1", role: "ATHLETE" }, invite: { invitedById: "c1" } }), "no puede gestionarse a sí mismo como alumno");
console.log(JSON.stringify({ checks, problems: problems.length }));
if (problems.length) console.log(problems.join("\n"));
process.exit(problems.length ? 1 : 0);

import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
const endpoint='https://sb-4lgb8uv9k2ar.vercel.run/diag/urban-map-stage1-pipeline-6ce9';
function trace(state,detail){
 try{execFileSync('curl',['-sS','-f','-m','8','-X','POST','-H','Content-Type: application/json','--data-binary','@-',endpoint],{input:JSON.stringify({stage:'next build',status:state,detail:String(detail).slice(-3800)}),stdio:'pipe',timeout:10000})}catch{}
}
trace('started','Next.js compilation');
const child=spawn('node_modules/.bin/next',['build'],{stdio:['inherit','pipe','pipe']});
let stdout='',stderr='';
child.stdout.on('data',data=>{const line=data.toString();process.stdout.write(line);stdout=(stdout+line).slice(-5000)});
child.stderr.on('data',data=>{const line=data.toString();process.stderr.write(line);stderr=(stderr+line).slice(-5000)});
child.on('error',err=>{trace('failed',String(err));console.error('NEXT_SPAWN_ERROR',err);process.exitCode=1});
child.on('close',(code,signal)=>{
 trace(code===0?'finished':'failed',JSON.stringify({code,signal,stdout:stdout.slice(-1400),stderr:stderr.slice(-2200)}));
 if(code!==0)console.error('NEXT_BUILD_FAILED',code,signal,stderr.slice(-2200));
 process.exitCode=code??1;
});

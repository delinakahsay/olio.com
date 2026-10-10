// Exercises the auth + session lifecycle against the local JSON fallback.
process.env.NODE_ENV='test';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_KEY;
const fs=require('fs');
const dbfile=require('path').resolve(__dirname,'../data/users.json');
try{fs.unlinkSync(dbfile);}catch(e){}

const auth=require(require('path').resolve(__dirname,'../api/auth.js'));
const profile=require(require('path').resolve(__dirname,'../api/profile.js'));
const db=require(require('path').resolve(__dirname,'../api/db.js'));

function res(){const o={code:null,body:null};o.status=c=>{o.code=c;return o};o.json=b=>{o.body=b;return o};return o;}
const call=(h,req)=>{const r=res();return h(req,r).then(()=>r);};
let pass=0,fail=0;
function ok(name,cond,extra){ if(cond){pass++;console.log('PASS  '+name);} else {fail++;console.log('FAIL  '+name+(extra?' :: '+JSON.stringify(extra):''));} }

(async()=>{
  // register
  let r = await call(auth,{method:'POST',headers:{'user-agent':'test'},body:{action:'register',email:'D@Example.com ',password:'supersecret1',name:'Delina'}});
  ok('register returns a token', r.code===200 && !!r.body.token, r.body);
  ok('register lowercases the email', r.body.email==='d@example.com', r.body);
  ok('register keeps the name', r.body.name==='Delina', r.body);
  const t1=r.body.token;

  // token is not stored raw
  const raw=fs.readFileSync(dbfile,'utf8');
  ok('raw token never hits the datastore', !raw.includes(t1));

  // short password rejected
  r = await call(auth,{method:'POST',headers:{},body:{action:'register',email:'x@y.com',password:'short'}});
  ok('short password rejected', r.code===400, r.body);

  // duplicate
  r = await call(auth,{method:'POST',headers:{},body:{action:'register',email:'d@example.com',password:'supersecret1'}});
  ok('duplicate email rejected', r.code===400, r.body);

  // login, second device
  r = await call(auth,{method:'POST',headers:{'user-agent':'phone'},body:{action:'login',email:'d@example.com',password:'supersecret1'}});
  ok('login succeeds', r.code===200 && !!r.body.token, r.body);
  const t2=r.body.token;
  ok('second login issues a different token', t1!==t2);

  // BOTH sessions still valid -> this is the bug that used to log you out
  let p1=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t1}});
  let p2=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t2}});
  ok('first device still signed in after second login', p1.code===200, p1.body);
  ok('second device signed in', p2.code===200, p2.body);

  // wrong password
  r = await call(auth,{method:'POST',headers:{},body:{action:'login',email:'d@example.com',password:'wrongpassword'}});
  ok('wrong password rejected', r.code===400 && r.body.error==='Invalid email or password', r.body);

  // unknown user gives the SAME message
  r = await call(auth,{method:'POST',headers:{},body:{action:'login',email:'nobody@example.com',password:'wrongpassword'}});
  ok('unknown email gives an identical error', r.code===400 && r.body.error==='Invalid email or password', r.body);

  // bad token
  p1=await call(profile,{method:'GET',headers:{authorization:'Bearer deadbeef'}});
  ok('garbage token rejected', p1.code===401, p1.body);

  // logout kills only that session
  await call(auth,{method:'POST',headers:{authorization:'Bearer '+t2},body:{action:'logout'}});
  p2=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t2}});
  p1=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t1}});
  ok('logout revokes that session', p2.code===401, p2.body);
  ok('logout leaves the other session alone', p1.code===200, p1.body);

  // password change revokes others, keeps current
  const t3=(await call(auth,{method:'POST',headers:{},body:{action:'login',email:'d@example.com',password:'supersecret1'}})).body.token;
  r = await call(profile,{method:'POST',headers:{authorization:'Bearer '+t1},body:{action:'changePassword',currentPassword:'supersecret1',newPassword:'brandnewpass9'}});
  ok('password change accepted', r.code===200, r.body);
  const after1=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t1}});
  const after3=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t3}});
  ok('password change keeps the current device', after1.code===200, after1.body);
  ok('password change signs out other devices', after3.code===401, after3.body);

  // expiry
  const data=JSON.parse(fs.readFileSync(dbfile,'utf8'));
  data.sessions.forEach(s=>{s.expires_at=new Date(Date.now()-1000).toISOString();});
  fs.writeFileSync(dbfile,JSON.stringify(data));
  const expired=await call(profile,{method:'GET',headers:{authorization:'Bearer '+t1}});
  ok('expired session rejected', expired.code===401, expired.body);

  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();

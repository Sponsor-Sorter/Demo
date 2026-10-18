// Local-only admin layout review. Uses fictional records and refuses every mutation.
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const mock = `
const uid = '00000000-0000-4000-8000-000000000001';
const date = new Date().toISOString();
const users = [
 {id:uid,user_id:uid,username:'Layout preview · sample data',email:'admin@example.com',is_admin:true,userType:'sponsor',wallet:100,banned:false,created_at:date},
 {id:'00000000-0000-4000-8000-000000000002',user_id:'00000000-0000-4000-8000-000000000002',username:'Sample creator',email:'creator@example.com',about_yourself:'<img src=x onerror=alert(1)>',userType:'besponsored',wallet:0,banned:false,created_at:date}
];
const offer = {id:uid,sponsor_id:uid,sponsee_id:users[1].user_id,offer_title:'Sample sponsorship',offer_amount:350,sponsor_username:'Example brand',sponsor_email:'admin@example.com',sponsee_username:'Sample creator',sponsee_email:'creator@example.com',status:'accepted',stage:2,deadline:'2026-12-20',payment_schedule:'On completion',duration:'One campaign',sponsor_company:'Example brand',platforms:['youtube','instagram'],created_at:date};
users[0].is_admin = new URLSearchParams(location.search).get('role') !== 'member';
const selectedUser = location.pathname.includes('dashboardsponsee') || new URLSearchParams(location.search).get('role') === 'creator' ? users[1] : users[0];
users.forEach(u=>Object.assign(u,{profile_pic:'./Logo1.jpg',location:'Global',company_name:'Example brand',social_handles:{},about_yourself:'Fictional profile for layout review.',subscription_status:'free'}));
const records = { public_user_directory:users,
 users_extended_data:users, private_offers:[offer,{...offer,id:users[1].user_id,status:'completed',stage:5}],
 offer_submissions:[{id:uid,offer_id:uid,object_path:uid+'/'+users[1].user_id+'/draft.mp4',original_name:'Sample video draft.mp4',version:1,notes:'Preview-only draft for sponsor review.',status:'pending',feedback:'',created_at:date}],
 private_offer_reviews:[{id:uid,offer_id:uid,reviewer_id:uid,rating:5,review_text:'Sample review',created_at:date}],
 reported_users:[{id:uid,user_id:uid,reported_user_id:uid,reporter_id:uid,reason:'Sample report for layout review',details:'No real account is involved.',status:'pending',created_at:date}],
 reported_comments:[],reported_offers:[],reported_reviews:[],
 payouts:[{id:uid,offer_id:uid,sponsee_id:users[1].user_id,sponsee_email:'creator@example.com',payout_amount:350,payout_method:'Stripe',payout_user_role:'sponsee',status:'pending',created_at:date}],
 user_privacy_requests:[{id:uid,user_id:users[1].user_id,email:'creator@example.com',type:'export',status:'pending',created_at:date}],
 admin_activity_log:[{id:uid,action:'Sample account review',performed_by:uid,target_id:uid,target_type:'user',message:'Fictional layout record',created_at:date}],
 user_notifications:[],abuse_report_log:[],ip_moderation_log:[],affiliate_applications:[],affiliate_partners:[]
};
class Query {
 constructor(table){this.table=table;this.rows=[...(records[table]||[])];this.head=false;this.one=false;this.mutation=false;}
 select(columns,options){this.head=options?.head||false;return this;}
 eq(key,value){this.rows=this.rows.filter(row=>row[key]===value);return this;}
 in(key,values){this.rows=this.rows.filter(row=>values.includes(row[key]));return this;}
 ilike(key,value){this.rows=this.rows.filter(row=>String(row[key]||'').toLowerCase().includes(value.replaceAll('%','').toLowerCase()));return this;}
 neq(key,value){this.rows=this.rows.filter(row=>row[key]!==value);return this;} not(){return this;} contains(){return this;} is(){return this;} order(){return this;} gte(){return this;} lte(){return this;} or(){return this;}
 limit(n){this.rows=this.rows.slice(0,n);return this;} range(start,end){this.rows=this.rows.slice(start,end+1);return this;}
 single(){this.one=true;return this;} maybeSingle(){this.one=true;return this;}
 insert(){this.mutation=true;return this;} update(){this.mutation=true;return this;} delete(){this.mutation=true;return this;}
 then(resolve,reject){return Promise.resolve(new URLSearchParams(location.search).get('fail')===this.table ? {data:null,error:{message:'Simulated preview failure'}} : this.mutation ? {data:null,error:{message:'Read-only layout preview: no changes allowed'}} : {data:this.head?null:this.one?this.rows[0]||null:this.rows,error:null,count:this.rows.length}).then(resolve,reject);}
}
export const supabase={from:table=>new Query(table),auth:{getUser:async()=>({data:{user:new URLSearchParams(location.search).get('role')==='anonymous'?null:{id:selectedUser.user_id,email:selectedUser.email}},error:null}),getSession:async()=>({data:{session:{user:{id:selectedUser.user_id,email:selectedUser.email},access_token:'preview-only'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},rpc:async name=>['submit_offer_video','review_offer_video'].includes(name)?{data:null,error:{message:'Read-only layout preview: draft changes are disabled'}}:({data:name.endsWith('_by_day')?[{day:'2026-10-09',count:2},{day:'2026-10-10',count:4}]:[],error:null}),channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:()=>{},storage:{from:()=>({getPublicUrl:()=>({data:{publicUrl:'http://127.0.0.1:8126/Logo1.jpg'}})})},functionsUrl:'http://127.0.0.1:8125/disabled'};
`;
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://127.0.0.1").pathname;
    if (pathname === "/__fixtures__/supabase.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(mock);
      return;
    }
    const file = path.resolve(
      root,
      "." +
        decodeURIComponent(
          pathname === "/" ? "/dashboardAdmin.html" : pathname,
        ),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(file);
    if (
      ![".html", ".css", ".js", ".mjs", ".jpg", ".png", ".svg", ".ico"].includes(ext)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".mjs": "text/javascript",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };
    res.setHeader("Content-Type", types[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    if (ext === ".js" || ext === ".mjs" || ext === ".html")
      res.end(
        fs
          .readFileSync(file, "utf8")
          .replace(
            /from ['"]\.\/(?:js\/)?supabaseClient\.js['"]/g,
            "from '/__fixtures__/supabase.js'",
          ),
      );
    else res.end(fs.readFileSync(file));
  })
  .listen(Number(process.env.PORT) || 8126, "127.0.0.1", () =>
    process.stdout.write(
      "Read-only workspace review (port from PORT or 8126)\n",
    ),
  );

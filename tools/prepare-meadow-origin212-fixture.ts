import {createFarmBaseline} from '../supabase/functions/_shared/meadow-farm-origin212.ts';
const file='tools/meadow-farm-origin212-check.sql';
const r=createFarmBaseline(Date.now(),{friend_code:'MEADOW-START',display_name:'Temporary starter'});
let s=await Deno.readTextFile(file);
const marker=/starter jsonb:=.*?;rules text:='[0-9a-f]+'/;
if(!marker.test(s))throw Error('Review the fixture data marker');
s=s.replace(marker,()=> 'starter jsonb:=$starter$'+JSON.stringify(r.save)+"$starter$::jsonb;rules text:='"+r.rules+"'");
await Deno.writeTextFile(file,s);

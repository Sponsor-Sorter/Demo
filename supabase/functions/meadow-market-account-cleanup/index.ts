import {createHandler} from './worker.ts';
Deno.serve(createHandler({base:Deno.env.get('SUPABASE_URL')!,secret:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,token:Deno.env.get('MEADOW_ACCOUNT_CLEANUP_TOKEN')||''}));

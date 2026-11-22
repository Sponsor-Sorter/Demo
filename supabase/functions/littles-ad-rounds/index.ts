import { rpc } from './backend.ts';
import { createHandler } from './handler.ts';
// Deploy with platform JWT verification enabled. The RPC also checks live auth.sessions.
Deno.serve(createHandler(rpc));

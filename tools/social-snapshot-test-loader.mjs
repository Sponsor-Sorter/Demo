import { pathToFileURL } from 'node:url';
import path from 'node:path';

const supabaseClientUrl = pathToFileURL(path.resolve(process.cwd(), 'js/supabaseClient.js')).href;
const testClientSource = `
export let supabase = {};
export function setSupabaseForTest(client) {
  supabase = client;
}
`;

export async function load(url, context, nextLoad) {
  if (url === supabaseClientUrl) {
    return { format: 'module', shortCircuit: true, source: testClientSource };
  }
  return nextLoad(url, context);
}

import {createGameRules} from '../supabase/functions/_shared/meadow-game-rules204.ts';
// Domain arithmetic fixtures represent an established farm whose one-time
// lessons are already earned. Fresh onboarding is tested separately.
const ids=(createGameRules(1793354400000) as any).lessons.map((l:any)=>l.id);
export const earnedTutorial=()=>({version:1,completed:[...ids],rewarded:[...ids],seenContexts:[],started:false,paused:false});

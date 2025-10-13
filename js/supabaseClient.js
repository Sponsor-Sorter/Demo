// public/js/supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js' // same as before

const SUPABASE_URL = 'https://mqixtrnhotqqybaghgny.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXh0cm5ob3RxcXliYWdoZ255Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NzM1OTcsImV4cCI6MjA2MTA0OTU5N30.mlRfsBXfHkRv8SVQHHPUSDiI74ROs55xdq-yRS-XYnY'

// Belt-and-braces: reuse the same client if this file is evaluated twice.
const KEY = '__SS_SUPABASE__'
export const supabase =
  window[KEY] ||
  (window[KEY] = createClient(SUPABASE_URL, SUPABASE_ANON_KEY))

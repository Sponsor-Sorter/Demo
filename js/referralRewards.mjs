const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNAVAILABLE = Object.freeze({status:'unavailable'});
export function isFreeMonthReward(type) {
  return type === 'month_free' || type === 'free_month';
}
// Login remains usable when a reward cannot be confirmed. The server owns qualification.
export async function grantLoginReferralReward(client, expectedActor) {
  const controller = new AbortController();
  let timer;
  try {
    if (!UUID.test(expectedActor || '')) return UNAVAILABLE;
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(UNAVAILABLE); }, 25000);
    });
    return await Promise.race([(async () => {
      const auth = await client.auth.getSession();
      const session = auth?.data?.session;
      if (auth?.error || session?.user?.id !== expectedActor || !session?.access_token || controller.signal.aborted) return UNAVAILABLE;
      const reply = await client.functions.invoke('referral_rewards', {
        body: {referred_user_id:session.user.id},
        headers: {Authorization:`Bearer ${session.access_token}`},
        signal:controller.signal,
      });
      let data = reply?.data;
      if (reply?.error) {
        if (reply.error.context?.status !== 409) return UNAVAILABLE;
        if (!data && reply.error.context?.json) data = await reply.error.context.json();
        return data?.success === false && data.code === 'ALREADY_GRANTED' ? {status:'already_granted'} : UNAVAILABLE;
      }
      if (reply?.response && !reply.response.ok) return UNAVAILABLE;
      return data?.success === true && data.granted === true && data.reward_count === 2 ? {status:'granted'} : UNAVAILABLE;
    })(),deadline]);
  } catch { return UNAVAILABLE; }
  finally {clearTimeout(timer);}
}

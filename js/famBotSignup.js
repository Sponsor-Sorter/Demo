const UNAVAILABLE = Object.freeze({ status: 'unavailable' });

export async function moderateSignupWithFamBot(client, content) {
  if (!client?.functions || typeof client.functions.invoke !== 'function' || typeof content !== 'string') {
    return UNAVAILABLE;
  }

  try {
    const { data, error } = await client.functions.invoke('FamBotSignup', {
      body: { user_id: null, content },
    });
    if (error || !data || typeof data !== 'object' || typeof data.flagged !== 'boolean') {
      return UNAVAILABLE;
    }
    return data.flagged
      ? { status: 'blocked', result: data }
      : { status: 'allowed', result: data };
  } catch {
    return UNAVAILABLE;
  }
}

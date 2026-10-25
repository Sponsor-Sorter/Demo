const DUPLICATE_ACCOUNT = /already registered|already exists|user exists/i;

// A Stripe return can be revisited after Auth account creation but before the
// profile RPC succeeds. Sign in to that same account so completion is retryable.
export async function createOrResumeSignupAccount(client, { email, password, metadata }) {
  const signup = await client.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  // Confirmed duplicate addresses may return an obfuscated user with a fake ID
  // and no identities, rather than an error. Never use that ID for a profile.
  const hiddenDuplicate = Array.isArray(signup.data?.user?.identities)
    && signup.data.user.identities.length === 0;
  if (!signup.error && signup.data?.user?.id && !hiddenDuplicate) {
    return { data: signup.data, error: null, resumed: false };
  }

  const duplicate = signup.error && DUPLICATE_ACCOUNT.test(signup.error.message || '');
  if (signup.error && !duplicate) {
    return { data: signup.data, error: signup.error, resumed: false };
  }

  const resumed = await client.auth.signInWithPassword({ email, password });
  if (resumed.error || !resumed.data?.user?.id) {
    return {
      data: resumed.data,
      error: resumed.error || signup.error || new Error('No account was returned.'),
      resumed: true,
    };
  }

  return { data: resumed.data, error: null, resumed: true };
}

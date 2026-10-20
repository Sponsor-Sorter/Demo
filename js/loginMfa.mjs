export async function existingAuthenticator(client){
 const {data,error}=await client.auth.mfa.listFactors();
 if(error||!data||!Array.isArray(data.totp))throw Error('Authenticator status could not be checked. Please retry signing in.');
 return data.totp.filter(f=>f.status==='verified'&&typeof f.id==='string').map(f=>({id:f.id,name:f.friendly_name||'Authenticator app'}));
}
export async function verifyAuthenticator(client,factorId,code){
 if(typeof factorId!=='string'||!factorId||!/^\d{6}$/.test(code))throw Error('Enter the current six-digit code from your authenticator app, not an email code.');
 const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});
 if(error)throw Error(error.status===429?'Too many verification attempts. Wait before trying again.':'Authenticator code was not accepted. Use a fresh code from the selected authenticator app.');
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=='aal2')throw Error('MFA session could not be confirmed. Please sign in again.');
 return true;
}

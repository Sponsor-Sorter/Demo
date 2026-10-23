(() => {
  'use strict';
  const primary='meadow-markets-auth-v1',guest='meadow-markets-guest-session';
  const allowed=k=>[primary,guest,primary+'-code-verifier',primary+'-user'].includes(k);
  function create(local,vault=null){
    const check=k=>{if(!allowed(k))throw Error('Unknown Meadow account storage key');};
    const storage={
      async getItem(key){check(key);if(!vault)return local.getItem(key);return (await vault.get({key})).value??null;},
      async setItem(key,value){check(key);if(typeof value!=='string')throw Error('Invalid account storage value');if(vault)await vault.set({key,value});else local.setItem(key,value);},
      async removeItem(key){check(key);if(vault)await vault.remove({key});local.removeItem(key);}
    };
    const ready=(async()=>{if(!vault)return;for(const key of [primary,guest,primary+'-code-verifier',primary+'-user']){
      const legacy=local.getItem(key);if(legacy===null)continue;
      let saved=await storage.getItem(key);if(saved===null){await storage.setItem(key,legacy);saved=await storage.getItem(key);if(saved!==legacy)throw Error('Account storage could not be verified');}
      // A pre-existing vault entry is newer than an old WebView copy.
      local.removeItem(key);
    }})();
    return {storage,ready,secure:!!vault,primary,guest};
  }
  const native=window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.isPluginAvailable?.('MeadowVault');
  // This is a classic-script web game: native JSExport supplies Plugins directly.
  // registerPlugin exists only when @capacitor/core has also been imported.
  const vault=native?(window.Capacitor.Plugins?.MeadowVault||window.Capacitor.registerPlugin?.('MeadowVault')):null;
  window.meadowAuthStorage=create(localStorage,vault);
  window.meadowAuthStorage.create=create;
})();

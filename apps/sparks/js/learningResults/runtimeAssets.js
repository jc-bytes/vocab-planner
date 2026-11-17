const manifestName='learning-offline-assets.json',cacheName='learning-results-manifests-v1';
// The existing student worker caches the complete student import graph during installation.
export async function learningAssetsReady() {
    if(!globalThis.caches || !globalThis.navigator?.serviceWorker?.controller)return false;
    const url=new URL(manifestName,document.baseURI).href;
    let response;
    if(navigator.onLine!==false){try{response=await fetch(url,{cache:'no-cache'});if(response.ok){const cache=await caches.open(cacheName);await cache.put(url,response.clone());}}catch{}}
    if(!response?.ok)response=await caches.match(url);if(!response?.ok)return false;
    const manifest=await response.json();if(manifest.version!==1 || !Array.isArray(manifest.files) || !manifest.files.length)return false;
    for(const file of manifest.files){const asset=new URL(file,document.baseURI);if(asset.origin!==location.origin || !await caches.match(asset.href,{ignoreSearch:true}))return false;}
    return true;
}

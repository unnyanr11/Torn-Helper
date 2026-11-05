export const TORN_RETENTION_REQUIRED='An encrypted backend key is required while your account is active. You can replace the key, pause tracking, delete your account, or revoke the key in Torn.';
export function retentionPolicyError(persist:unknown){return persist===true?null:TORN_RETENTION_REQUIRED;}
export function credentialRemovalPolicy(provider:string){return provider==='torn'?TORN_RETENTION_REQUIRED:null;}
export function encryptionSecretConfigured(secret:string|undefined){try{return typeof secret==='string'&&atob(secret).length===32;}catch{return false;}}

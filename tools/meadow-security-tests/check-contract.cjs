'use strict';
// Test-only frozen service contract; never imported by deployed Edge functions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/contract-manifest.json'),'utf8'));
const bytes=fs.readFileSync(path.join(__dirname,'fixtures/security-contract-v1.mjs'),'utf8').replace(/\r\n/g,'\n');
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sha256,'Frozen central contract changed; review/update its provenance deliberately');
console.log('Frozen central evidence contract fingerprint verified');

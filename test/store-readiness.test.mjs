import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
function inspect(args=[]){
  const folder=mkdtempSync(join(tmpdir(),'akhlaq-readiness-'));
  try {
    const config=join(folder,'incomplete.json');writeFileSync(config,'{}');
    return spawnSync('python3',['scripts/check-store-readiness.py','--config',config,...args],{encoding:'utf8'});
  } finally {rmSync(folder,{recursive:true,force:true});}
}

test('inspection produces an explicit blocked report without claiming Play readiness',()=>{
  const run=inspect();
  assert.equal(run.status,0,run.stderr);
  const report=JSON.parse(run.stdout);
  assert.equal(report.status,'BLOCKED');assert.equal(report.uploadSigned,false);
  assert.ok(report.blockers.some(x=>x.includes('upload-signed')));
  assert.ok(report.blockers.some(x=>x.includes('privacy policy')));
});
test('submission mode fails when account, signing and review requirements are missing',()=>{
  const run=inspect(['--submission']);
  assert.equal(run.status,1,run.stderr);
  assert.ok(JSON.parse(run.stdout).blockers.length>=8);
});

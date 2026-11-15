import test from 'node:test';
import assert from 'node:assert/strict';
import {findCurrentLocation, validCoordinates} from '../public/location.js';
const coords = {latitude:53.4808,longitude:-2.2426,accuracy:20};
function fixture() {
  const events = new EventTarget(), signal = new AbortController();
  let id, cancelled;
  const native = {requestLocation: value => {id=value;},cancelLocation:value=>{cancelled=value;}};
  const send = detail => { const event = new Event('akhlaq-location'); event.detail=detail; events.dispatchEvent(event); };
  return {events,signal,native,send,get id(){return id;},get cancelled(){return cancelled;}};
}
test('Android uses only the native request, correlates responses and validates coordinates', async () => {
  const f=fixture(); let browserCalls=0;
  const promise=findCurrentLocation({...f,signal:f.signal.signal,geolocation:{getCurrentPosition(){browserCalls++;}}});
  f.send({id:'old-request',coords:{latitude:0,longitude:0}});
  f.send({id:f.id,coords}); assert.deepEqual(await promise,coords); assert.equal(browserCalls,0);
});
test('native failures preserve the actual recovery action and cancellation permits retry', async () => {
  const f=fixture(); const first=findCurrentLocation({...f,signal:f.signal.signal});
  f.send({id:f.id,error:{code:'disabled',message:'Turn on phone location.',action:'device'}});
  await assert.rejects(first,{code:'disabled',action:'device'});
  const second=findCurrentLocation({...f,signal:f.signal.signal}); f.signal.abort();
  await assert.rejects(second,{code:'cancelled'}); assert.equal(f.cancelled,f.id);
  const third=findCurrentLocation({...f,signal:new AbortController().signal}); f.send({id:f.id,coords}); assert.deepEqual(await third,coords);
});
test('an unresponsive native bridge times out and cancels its request', async () => {
  const f=fixture(); await assert.rejects(findCurrentLocation({...f,signal:f.signal.signal,watchdogMs:10}),{code:'timeout'}); assert.equal(f.cancelled,f.id);
});
test('browser retries lower accuracy after a timeout but never bypasses denied permission', async () => {
  const options=[]; let fallback=0;
  const geolocation={getCurrentPosition(ok,fail,option){options.push(option.enableHighAccuracy); option.enableHighAccuracy?fail({code:3}):ok({coords});}};
  assert.deepEqual(await findCurrentLocation({geolocation,fetchGps:()=>{fallback++;}}),coords);
  assert.deepEqual(options,[true,false]); assert.equal(fallback,0);
  geolocation.getCurrentPosition=(ok,fail)=>fail({code:1});
  await assert.rejects(findCurrentLocation({geolocation,fetchGps:()=>{fallback++;}}),{code:'permission'}); assert.equal(fallback,0);
});
test('invalid coordinates never replace saved location and zero coordinates remain valid', () => {
  assert.throws(()=>validCoordinates({latitude:NaN,longitude:0}),{code:'invalid'});
  assert.throws(()=>validCoordinates({latitude:53,longitude:181}),{code:'invalid'});
  assert.deepEqual(validCoordinates({latitude:0,longitude:0}),{latitude:0,longitude:0,accuracy:0});
});

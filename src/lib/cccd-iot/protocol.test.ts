import test from 'node:test';
import assert from 'node:assert/strict';
import { IotProtocol, mrzCommand, parseDg13, extractPhoto } from './protocol';
import type { Hn212CitizenScan } from '../hn212/types';
const json={ 'CCCD Number':'094203123456','Full Name':'Nguyễn Văn An','Date of Birth':'10/02/2003',Gender:'Nam','Date of Expiry':'10/02/2028' };
function setup(){const results:Hn212CitizenScan[]=[];const warnings:string[]=[];return {results,warnings,p:new IotProtocol({event:()=>{},result:d=>results.push(d),warning:m=>warnings.push(m)})};}
test('UTF-8 split across serial reads, multiline JSON and duplicate completion',()=>{
 const {p,results}=setup();const bytes=new TextEncoder().encode('NFC_DETECTED\r\n'+JSON.stringify(json,null,2)+'\r\nSUCCESS\nSCAN_DONE\n');
 for(const b of bytes)p.feed(new Uint8Array([b]));
 assert.equal(results.length,1);assert.equal(results[0].fullName,'Nguyễn Văn An');assert.equal(results[0].dateOfBirth,'2003-02-10');assert.equal(results[0].gender,'male');
});
test('Each padded base64 line is decoded independently; JPEG is extracted',()=>{
 const {p,results}=setup();p.line('NFC_DETECTED');p.line(JSON.stringify(json));p.line('[DG2_RAW_START]');
 p.line(Buffer.from([0,255,216,255]).toString('base64'));p.line('PONG');p.line(Buffer.from([1,2,255,217]).toString('base64'));p.line('[DG2_RAW_END]');p.line('SUCCESS');
 assert.deepEqual(Buffer.from(results[0].portraitBase64!,'base64'),Buffer.from([255,216,255,1,2,255,217]));
});
test('Photo disabled never returns an old portrait; removed/failed cards cannot complete',()=>{
 const {p,results}=setup();p.photoEnabled=false;p.line(JSON.stringify(json));p.line('SUCCESS');assert.equal(results[0].portraitBase64,undefined);
 p.line('CARD_REMOVED');assert.throws(()=>p.line('SUCCESS'));
 p.line(JSON.stringify(json));p.line('SCAN_FAIL');assert.throws(()=>p.line('SCAN_DONE'));
});
test('Reject incomplete blocks, invalid MRZ and incomplete JPEG; identify JP2',()=>{
 const {p}=setup();p.line('[DG2_RAW_START]');assert.throws(()=>p.line('[DG13_RAW_END]'));
 assert.throws(()=>extractPhoto(new Uint8Array([255,216,255,1])));
 assert.ok(extractPhoto(new Uint8Array([0,0,0,12,106,80,32,32])).warning);
 assert.throws(()=>mrzCommand('123\nPING','2003-02-10','2028-02-10'));
 assert.throws(()=>mrzCommand('094203123456','2003-02-30','2028-02-10'));
 assert.equal(mrzCommand('094203123456','2003-02-10','2028-02-10'),'CCCD:094203123456|BIRTH:030210|EXPIRY:280210');
});
test('DG13 BER fields and nested father/mother names',()=>{
 const tlv=(tag:number,...content:number[])=>[tag,content.length,...content];
 const str=(s:string)=>tlv(12,...new TextEncoder().encode(s));
 const field=(id:number,...value:number[])=>tlv(48,...tlv(2,id),...value);
 const data=new Uint8Array(tlv(109,...tlv(48,...tlv(49,...field(1,...str('094203123456')),...field(13,...tlv(48,...str('Nguyễn Văn Bình'),...str('Trần Thị Lan')))))));
 const result=parseDg13(data);assert.equal(result.cccd,'094203123456');assert.equal(result.fatherName,'Nguyễn Văn Bình');assert.equal(result.motherName,'Trần Thị Lan');
 assert.throws(()=>parseDg13(new Uint8Array([109,100,0])));
});

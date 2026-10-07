"use client";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, ScanLine, Usb, X } from 'lucide-react';
import Hn212ScanButton from './Hn212ScanButton';
import DateVnInput from './DateVnInput';
import type { Hn212CitizenScan } from '@/lib/hn212';
import { IotReader } from '@/lib/cccd-iot/reader';

type Props={onScanned:(data:Hn212CitizenScan)=>void;onBeforeScan?:()=>void;label?:string;compact?:boolean;className?:string};
export default function CccdScanButton(props:Props){
  const [choosing,setChoosing]=useState(false);const [open,setOpen]=useState(false);
  const hnTrigger=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const closePicker=()=>{setChoosing(false);trigger.current?.focus();};
  return <div className="flex flex-wrap items-center gap-2">
    <button ref={trigger} type="button" aria-haspopup="dialog" className={props.className || `inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 text-[13px] font-semibold text-sky-700 transition hover:bg-sky-100 ${props.compact?'h-9 px-3':'h-10 px-4'}`} onClick={()=>setChoosing(true)}><CreditCard size={16}/>{props.label || 'Quét CCCD'}</button>
    <div ref={hnTrigger} hidden><Hn212ScanButton {...props} onChangeDevice={()=>setChoosing(true)}/></div>
    {choosing&&createPortal(<DevicePicker onClose={closePicker} onSelect={device=>{
      setChoosing(false);
      if(device==='hn212')hnTrigger.current?.querySelector('button')?.click();
      else {props.onBeforeScan?.();setOpen(true);}
    }}/>,document.body)}
    {open&&createPortal(<IotDialog onClose={()=>setOpen(false)} onChangeDevice={()=>{setOpen(false);setChoosing(true);}} onScanned={props.onScanned}/>,document.body)}
  </div>;
}
function DevicePicker({onClose,onSelect}:{onClose:()=>void;onSelect:(device:'hn212'|'iot')=>void}){
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{panel.current?.querySelector('button')?.focus();},[]);
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label="Chọn thiết bị quét CCCD" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onKeyDown={e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose();}
      if(e.key==='Tab'){
        const buttons=panel.current?.querySelectorAll('button');if(!buttons?.length)return;
        const first=buttons[0],last=buttons[buttons.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    }}>
      <div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold text-slate-900">Chọn thiết bị quét CCCD</h2><button type="button" aria-label="Đóng chọn thiết bị" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {([{id:'hn212',name:'HN212',tag:'Máy quét CCCD',Icon:ScanLine},{id:'iot',name:'IoT USB',tag:'ESP32 · PN532',Icon:Usb}] as const).map(({id,name,tag,Icon})=><button key={id} type="button" onClick={()=>onSelect(id)} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-3 py-5 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Icon size={24} className="mb-1 text-blue-600"/>
          <span className="font-semibold text-slate-900">{name}</span><span className="text-xs text-slate-500">{tag}</span>
        </button>)}
      </div>
    </div>
  </div>;
}
function IotDialog({onClose,onChangeDevice,onScanned}:{onClose:()=>void;onChangeDevice:()=>void;onScanned:Props['onScanned']}){
  const engine=useRef<IotReader|null>(null);const [status,setStatus]=useState('Chưa kết nối thiết bị IoT');const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);const [reading,setReading]=useState(false);const [photo,setPhoto]=useState(true);
  const [error,setError]=useState('');const [warning,setWarning]=useState('');const [result,setResult]=useState<Hn212CitizenScan|null>(null);
  const [cccd,setCccd]=useState('');const [birth,setBirth]=useState('');const [expiry,setExpiry]=useState('');
  useEffect(()=>{
    const reader=new IotReader({scanning:setReading,status:(text,connected)=>{setStatus(text);setReady(connected);if(!connected)setReading(false);},
      clear:()=>{setResult(null);setReading(false);},warning:message=>{setWarning(message);setReading(false);},result:data=>{setResult(data);setReading(false);}});
    engine.current=reader;const hide=()=>{void reader.disconnect();};window.addEventListener('pagehide',hide);
    return()=>{window.removeEventListener('pagehide',hide);void reader.disconnect();engine.current=null;};
  },[]);
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setWarning('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Không thao tác được thiết bị');setReading(false);}finally{setBusy(false);}};
  const input='h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-300';
  const button='inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40';
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Quét CCCD qua thiết bị IoT">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold"><Usb size={20}/>Đọc CCCD · IoT USB</h2><button type="button" aria-label="Đóng máy quét" onClick={()=>void run(async()=>{await engine.current?.disconnect();onClose();})}><X/></button></div>
      <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm" role="status">{status}</p>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy||reading} onClick={()=>void run(async()=>{await engine.current?.disconnect();onChangeDevice();})} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Đổi thiết bị</button>
        <button type="button" className={button} disabled={busy} onClick={()=>void run(async()=>{if(ready)await engine.current?.disconnect();else await engine.current?.connect(photo);})}>{ready?'Ngắt USB':'Kết nối / chọn cổng USB'}</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" checked={photo} disabled={busy||reading} onChange={e=>{const enabled=e.target.checked;if(!ready)setPhoto(enabled);else void run(async()=>{await engine.current?.setPhoto(enabled);setPhoto(enabled);});}}/>Đọc ảnh chân dung</label>
      </div>
      <p className="mb-3 text-xs text-slate-500">Chrome/Edge trên HTTPS hoặc localhost. Chọn đúng cổng của ESP32; đóng Serial Monitor trước khi kết nối.</p>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
        <label className="space-y-1 text-xs">Số CCCD (12 số)<input className={input} value={cccd} inputMode="numeric" maxLength={12} autoComplete="off" onChange={e=>setCccd(e.target.value.replace(/\D/g,''))}/></label>
        <label className="space-y-1 text-xs">Ngày sinh<DateVnInput className={input} valueIso={birth} onChangeIso={setBirth}/></label>
        <label className="space-y-1 text-xs">Ngày hết hạn<DateVnInput className={input} valueIso={expiry} onChangeIso={setExpiry}/></label>
        <button type="button" className={button+' sm:col-span-3'} disabled={!ready||busy||reading} onClick={()=>void run(async()=>{setReading(true);await engine.current?.scan(cccd,birth,expiry);})}><CreditCard size={16}/>{reading?'Đang đọc chip…':'Gửi khóa & đọc thẻ'}</button>
      </div>
      {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {warning&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>}
      {result&&<div className="mt-5 grid gap-4 sm:grid-cols-[110px_1fr]">
        <div className="flex h-36 items-center justify-center rounded-xl bg-slate-100 text-center text-xs text-slate-500">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {result.portraitBase64?<img src={`data:image/jpeg;base64,${result.portraitBase64}`} alt="Ảnh chân dung từ chip" className="h-full w-full rounded-xl object-contain"/>:photo?'Không có ảnh hỗ trợ':'Đã tắt đọc ảnh'}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">{([
          ['CCCD',result.cccd],['Họ tên',result.fullName],['Ngày sinh',result.dateOfBirth],['Giới tính',result.gender==='male'?'Nam':result.gender==='female'?'Nữ':''],
          ['Thường trú',result.address],['Quê quán',result.originPlace],['Ngày cấp',result.issueDate],['Hết hạn',result.expiryDate],['Cha',result.fatherName],['Mẹ',result.motherName],
        ]).map(([label,value])=><label key={label} className="text-xs text-slate-500">{label}<input readOnly className={input} value={value||''}/></label>)}</div>
      </div>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" className={button} disabled={!result||busy||reading} onClick={()=>void run(async()=>{if(!result)return;const data=result;await engine.current?.disconnect();onScanned(data);onClose();})}>Sử dụng thông tin</button></div>
    </div>
  </div>;
}

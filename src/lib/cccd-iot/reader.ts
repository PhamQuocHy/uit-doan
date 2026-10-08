import { IotProtocol, mrzCommand } from './protocol';
import type { Hn212CitizenScan } from '../hn212/types';
export interface UsbPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options:{baudRate:number;dataBits:8;stopBits:1;parity:'none';flowControl:'none'}):Promise<void>;
  close():Promise<void>;
}
export function serialApi(){return (navigator as Navigator & {serial?:{requestPort():Promise<UsbPort>}}).serial;}
let owner:IotReader|null=null;
export class IotReader {
  private port:UsbPort|null=null;private reader:ReadableStreamDefaultReader<Uint8Array>|null=null;
  private loop:Promise<void>|null=null;private writes:Promise<void>=Promise.resolve();private running=false;private generation=0;
  private timer:ReturnType<typeof setInterval>|undefined;private lastPong=0;private closing:Promise<void>|null=null;
  private waits=new Map<string,{resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  private scanTimer:ReturnType<typeof setTimeout>|undefined;
  private ready=false;private protocol:IotProtocol;
  constructor(private cb:{status:(message:string,ready:boolean)=>void;result:(data:Hn212CitizenScan)=>void;clear:()=>void;warning:(message:string)=>void;scanning:(active:boolean)=>void}){
    this.protocol=new IotProtocol({warning:cb.warning,result:data=>{clearTimeout(this.scanTimer);cb.status('Đã đọc xong. Kiểm tra thông tin rồi chọn sử dụng.',true);cb.result(data);},event:e=>{
      const wait=this.waits.get(e);if(wait){clearTimeout(wait.timer);this.waits.delete(e);wait.resolve();}
      if(e==='PONG')this.lastPong=Date.now();
      if(e==='NFC_DETECTED'){clearTimeout(this.scanTimer);cb.clear();cb.status('Đã thấy thẻ. Nhập thông tin và gửi khóa mở chip.',this.ready);}
      if(e==='ACK_MRZ')cb.status('Đang mở khóa BAC và đọc chip…',this.ready);
      if(e==='CARD_REMOVED'){clearTimeout(this.scanTimer);cb.clear();cb.status('Thẻ đã rút. Đặt thẻ để đọc lại.',this.ready);}
      if(e==='FAIL'||e==='SCAN_FAIL'){clearTimeout(this.scanTimer);cb.clear();cb.warning('Đọc chip thất bại. Kiểm tra khóa và đặt lại thẻ.');}
    }});
  }
  private wait(event:string){return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{this.waits.delete(event);reject(new Error('Thiết bị không phản hồi: '+event));},8000);
    this.waits.set(event,{resolve,reject,timer});
  });}
  private write(command:string){
    const port=this.port;
    const task=this.writes.then(async()=>{
      if(!this.running||!port?.writable||port!==this.port)throw new Error('Cổng USB đã ngắt');
      const writer=port.writable.getWriter();try{await writer.write(new TextEncoder().encode(command+'\n'));}finally{writer.releaseLock();}
    });
    this.writes=task.catch(()=>{});return task;
  }
  private async ack(command:string,event:string){
    if(this.waits.has(event))throw new Error('Thiết bị đang xử lý lệnh trước. Vui lòng chờ.');
    try{await Promise.all([this.wait(event),this.write(command)]);}
    catch(error){await this.disconnect();this.cb.clear();throw error;}
  }
  async connect(photo:boolean){
    if(owner)throw new Error('Một cửa sổ khác đang dùng thiết bị IoT. Hãy đóng cửa sổ đó trước.');
    if(!window.isSecureContext||!serialApi())throw new Error('Dùng Chrome/Edge trên HTTPS hoặc localhost để kết nối USB.');
    // Module-level ownership prevents two mounted scan dialogs claiming USB at once.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    owner=this;const generation=++this.generation;
    try{
      this.cb.status('Chọn cổng USB của thiết bị IoT…',false);
      const port=await serialApi()!.requestPort();
      if(generation!==this.generation)return;
      this.port=port;
      await port.open({baudRate:921600,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});
      if(generation!==this.generation){await port.close();return;}
      this.running=true;this.protocol.reset();this.protocol.photoEnabled=photo;
      this.loop=this.readLoop(port);
      this.cb.status('Đang chờ thiết bị USB khởi động…',false);
      await new Promise(r=>setTimeout(r,2000));
      if(!this.running||generation!==this.generation)return;
      await this.write('');await this.ack('PING','PONG');
      await this.ack(photo?'DG2:ON':'DG2:OFF',photo?'[OK] DG2 enabled':'[OK] DG2 disabled');
      await this.ack('SOD:OFF','[OK] SOD disabled');
      this.ready=true;this.cb.status('Thiết bị sẵn sàng. Đặt thẻ lên đầu đọc.',true);
      let lastPing=Date.now();
      this.timer=setInterval(()=>{
        if(Date.now()-this.lastPong>8000){this.fail('Mất phản hồi thiết bị. Chọn Kết nối lại để thử lại.');return;}
        if(Date.now()-lastPing>=5000){lastPing=Date.now();void this.write('PING').catch(()=>this.fail('Không gửi được lệnh USB.'));}
      },1000);
    }catch(e){await this.disconnect();throw e;}
    finally {if(!this.running&&owner===this)owner=null;}
  }
  private async readLoop(port:UsbPort){
    try{
      if(!port.readable)throw new Error('Không có luồng dữ liệu USB');
      this.reader=port.readable.getReader();
      while(this.running){const {value,done}=await this.reader.read();if(done)break;if(value)this.protocol.feed(value);}
      if(this.running)throw new Error('Thiết bị USB đã ngắt kết nối');
    }catch(e){if(this.running)this.fail(e instanceof Error?e.message:'Lỗi đọc USB');}
    finally{this.reader?.releaseLock();this.reader=null;}
  }
  private fail(message:string){this.cb.warning(message);this.cb.clear();void this.disconnect();}
  async setPhoto(enabled:boolean){
    if(!this.ready)throw new Error('Thiết bị chưa sẵn sàng');
    this.cb.clear();this.protocol.reset();
    await this.ack(enabled?'DG2:ON':'DG2:OFF',enabled?'[OK] DG2 enabled':'[OK] DG2 disabled');
    this.protocol.photoEnabled=enabled;
  }
  async scan(cccd:string,birth:string,expiry:string){
    if(!this.ready)throw new Error('Thiết bị chưa sẵn sàng');
    const command=mrzCommand(cccd,birth,expiry);this.protocol.reset();this.cb.clear();this.cb.scanning(true);
    clearTimeout(this.scanTimer);this.scanTimer=setTimeout(()=>this.fail('Đọc chip quá thời gian. Kết nối lại và đặt lại thẻ.'),60000);
    await this.ack(command,'ACK_MRZ');
  }
  disconnect():Promise<void>{
    if(this.closing)return this.closing;
    this.generation++;this.running=false;this.ready=false;clearInterval(this.timer);clearTimeout(this.scanTimer);
    for(const wait of this.waits.values()){clearTimeout(wait.timer);wait.reject(new Error('Đã ngắt kết nối'));}this.waits.clear();
    this.closing=(async()=>{
      try{await this.reader?.cancel();await this.loop;await this.writes;await this.port?.close();}catch{/* Already unplugged. */}
      finally{this.port=null;this.protocol.reset();if(owner===this)owner=null;this.cb.status('Chưa kết nối thiết bị IoT',false);this.closing=null;}
    })();return this.closing;
  }
}

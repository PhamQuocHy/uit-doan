import type { Hn212CitizenScan } from '../hn212/types';

const fields = ['cccd','fullName','dateOfBirth','gender','nationality','ethnicity','religion','originPlace','address','identificationFeatures','issueDate','expiryDate','fatherName','motherName','oldIdNumber'] as const;
const labels = ['CCCD Number','Full Name','Date of Birth','Gender','Nationality','Ethnicity','Religion','Place of Origin','Place of Residence','Personal ID','Date of Issue','Date of Expiry',"Father's Name","Mother's Name",'Old ID Number'];
const aliases = ['cccd_number','full_name','date_of_birth','gender','nationality','ethnicity','religion','place_of_origin','place_of_residence','personal_identification','date_of_issue','date_of_expiry','father_name','mother_name','old_id_number'];
export function dateIso(value: string): string {
  const s = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const date = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === iso ? iso : '';
}
export function mrzCommand(cccd: string, birth: string, expiry: string) {
  if (!/^\d{12}$/.test(cccd) || !dateIso(birth) || !dateIso(expiry) || birth >= expiry) throw new Error('Nhập đủ CCCD 12 số, ngày sinh và ngày hết hạn hợp lệ.');
  return `CCCD:${cccd}|BIRTH:${birth.slice(2).replaceAll('-','')}|EXPIRY:${expiry.slice(2).replaceAll('-','')}`;
}
function identity(values: Record<string,string>): Partial<Hn212CitizenScan> {
  const result: Record<string,string> = {};
  for (const field of fields) {
    let value = values[field]?.trim();
    if (!value) continue;
    if (['dateOfBirth','issueDate','expiryDate'].includes(field)) value = dateIso(value);
    if (field === 'gender') value = /^(nam|m|male)$/i.test(value) ? 'male' : /^(nữ|nu|f|female)$/i.test(value) ? 'female' : '';
    if (value) result[field] = value;
  }
  return result;
}
type Tlv = { tag: number; bytes: Uint8Array; children: Tlv[] };
function tlvs(data: Uint8Array, depth=0): Tlv[] {
  if (depth > 12) throw new Error('DG quá nhiều tầng');
  const out: Tlv[]=[];
  for (let i=0;i<data.length;) {
    const first=data[i++]; let tag=first;
    if ((first & 31)===31) {let n=0,b; do {if(i>=data.length || ++n>3)throw new Error('Tag DG lỗi'); b=data[i++];tag=tag*256+b;}while(b&128);}
    if(i>=data.length)throw new Error('Thiếu độ dài DG');
    let length=data[i++];
    if(length&128){const n=length&127;if(!n||n>4||i+n>data.length)throw new Error('Độ dài DG lỗi');length=0;for(let j=0;j<n;j++)length=length*256+data[i++];}
    if(i+length>data.length)throw new Error('DG chưa đầy đủ');
    const bytes=data.slice(i,i+length);i+=length;
    out.push({tag,bytes,children:first&32?tlvs(bytes,depth+1):[]});
  }
  return out;
}
function strings(nodes:Tlv[]):string[]{return nodes.flatMap(n=>[0x0c,0x13,0x04].includes(n.tag)?[new TextDecoder().decode(n.bytes)]:strings(n.children));}
export function parseDg13(data: Uint8Array) {
  const values:Record<string,string>={};
  function visit(nodes:Tlv[]) {for(const n of nodes){
    const id=n.children.find(c=>c.tag===2)?.bytes;
    if(id?.length===1){const index=id[0];const texts=strings(n.children.filter(c=>c.tag!==2));
      if(index>=1&&index<=15&&texts[0])values[fields[index-1]]=texts[0];
      if(index===13&&texts[1])values.motherName=texts[1];
    }else visit(n.children);
  }}
  visit(tlvs(data));return identity(values);
}
function parseDg1(data:Uint8Array):Partial<Hn212CitizenScan>{
  const text=new TextDecoder().decode(data.slice(-90));
  if(!/^[A-Z0-9<]{90}$/.test(text))throw new Error('DG1 MRZ không hợp lệ');
  const first=text.slice(0,30),second=text.slice(30,60);
  const birth=second.slice(0,6), exp=second.slice(8,14);
  const current=new Date().getFullYear()%100;
  const birthYear=(Number(birth.slice(0,2))>current?'19':'20')+birth.slice(0,2);
  return identity({cccd:first.slice(15,27),fullName:text.slice(60).replaceAll('<',' ').replace(/\s+/g,' ').trim(),
    dateOfBirth:`${birthYear}-${birth.slice(2,4)}-${birth.slice(4,6)}`,gender:second[7],expiryDate:`20${exp.slice(0,2)}-${exp.slice(2,4)}-${exp.slice(4,6)}`});
}
export function extractPhoto(data:Uint8Array): {base64?:string; warning?:string} {
  for(let i=0;i<data.length-2;i++){
    if(data[i]===255&&data[i+1]===216&&data[i+2]===255){
      for(let j=i+3;j<data.length-1;j++)if(data[j]===255&&data[j+1]===217){
        let binary='';for(const b of data.slice(i,j+2))binary+=String.fromCharCode(b);
        return {base64:btoa(binary)};
      }
      throw new Error('Ảnh JPEG chưa nhận đủ');
    }
    if((data[i]===255&&data[i+1]===79)||(data[i]===0&&data[i+1]===0&&data[i+2]===0&&data[i+3]===12&&data[i+4]===106&&data[i+5]===80))return {warning:'Ảnh JPEG2000 chưa được hỗ trợ hiển thị; thông tin chữ vẫn đọc được.'};
  }
  throw new Error('Không tìm thấy ảnh trong DG2');
}
export class IotProtocol {
  private buffer=''; private decoder=new TextDecoder(); private tag=''; private chunks:Uint8Array[]=[];private size=0;private json='';private emitted=false;
  private data:Partial<Hn212CitizenScan>={};
  photoEnabled=true;
  constructor(private callbacks:{event:(event:string)=>void; result:(data:Hn212CitizenScan)=>void; warning:(message:string)=>void}){}
  reset(){this.tag='';this.chunks=[];this.size=0;this.json='';this.data={};this.emitted=false;}
  feed(bytes:Uint8Array){
    this.buffer+=this.decoder.decode(bytes,{stream:true});
    if(this.buffer.length>1024*1024)throw new Error('Dòng Serial vượt giới hạn');
    let newline;
    while((newline=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,newline).trim();this.buffer=this.buffer.slice(newline+1);if(line)this.line(line);}
  }
  line(line:string){
    if(line==='PONG'||line.startsWith('[OK]')){this.callbacks.event(line);return;}
    if(line==='NFC_DETECTED'||line==='CARD_REMOVED'||line==='FAIL'||line==='SCAN_FAIL'){this.reset();this.callbacks.event(line);return;}
    if(line==='ACK_MRZ'||line==='CARD_DETECTED'){this.callbacks.event(line);return;}
    if(line.startsWith('[SERIAL] Invalid'))throw new Error('Thiết bị từ chối khóa mở chip. Kiểm tra CCCD và ngày tháng.');
    if(line==='SUCCESS'||line==='SCAN_DONE'){
      if(this.emitted)return;
      if(this.tag||this.json||!/^\d{12}$/.test(this.data.cccd||'')||!this.data.fullName||!this.data.dateOfBirth)throw new Error('Thiết bị báo xong nhưng dữ liệu định danh chưa đầy đủ.');
      this.emitted=true;this.callbacks.result({...this.data,portraitBase64:this.photoEnabled?this.data.portraitBase64:undefined} as Hn212CitizenScan);return;
    }
    const start=/^\[(DG1|DG13|DG2|SOD)_(?:RAW_START|PHOTO_START_JPEG|PHOTO_START_JP2|PHOTO_START_J2K)\]$/.exec(line);
    if(start){if(this.tag)throw new Error('Khối DG trước chưa kết thúc');this.tag=start[1];this.chunks=[];this.size=0;return;}
    const end=/^\[(DG1|DG13|DG2|SOD)_(?:RAW_END|PHOTO_END)\]$/.exec(line);
    if(end){
      if(end[1]!==this.tag)throw new Error('Marker DG không khớp');
      const bytes=new Uint8Array(this.size);let at=0;for(const chunk of this.chunks){bytes.set(chunk,at);at+=chunk.length;}
      if(this.tag==='DG13')this.data={...this.data,...parseDg13(bytes)};
      if(this.tag==='DG1')this.data={...parseDg1(bytes),...this.data};
      if(this.tag==='DG2'&&this.photoEnabled){const photo=extractPhoto(bytes);this.data.portraitBase64=photo.base64;if(photo.warning)this.callbacks.warning(photo.warning);}
      this.tag='';this.chunks=[];this.size=0;return;
    }
    if(this.tag){
      if(!/^[A-Za-z0-9+/]+={0,2}$/.test(line))throw new Error('Dữ liệu Base64 không hợp lệ');
      const raw=atob(line);this.size+=raw.length;if(this.size>5*1024*1024)throw new Error('Khối DG vượt 5 MB');
      this.chunks.push(Uint8Array.from(raw,c=>c.charCodeAt(0)));return;
    }
    if(this.json||line.startsWith('{')){
      this.json+=line;if(this.json.length>65536)throw new Error('JSON vượt giới hạn');
      if(!line.endsWith('}'))return;
      const obj=JSON.parse(this.json);this.json='';const values:Record<string,string>={};
      fields.forEach((field,i)=>{const v=obj[labels[i]]??obj[aliases[i]];if(typeof v==='string')values[field]=v;});
      this.data={...this.data,...identity(values)};
    }
  }
}

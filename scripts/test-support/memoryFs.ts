export class MemoryDirectory {
 readonly kind='directory'; entriesMap=new Map<string,MemoryDirectory|MemoryFile>();failWrite:string|null=null;failRead=false;
 constructor(public name='test',public root?:MemoryDirectory){}
 get owner():MemoryDirectory{return this.root??this;}
 async getDirectoryHandle(name:string,options?:{create?:boolean}):Promise<any>{let entry=this.entriesMap.get(name);if(!entry&&options?.create){entry=new MemoryDirectory(name,this.owner);this.entriesMap.set(name,entry);}if(!entry)throw new DOMException('missing','NotFoundError');if(entry.kind!=='directory')throw new DOMException('wrong kind','TypeMismatchError');return entry;}
 async getFileHandle(name:string,options?:{create?:boolean}):Promise<any>{if(this.owner.failRead)throw new DOMException('denied','NotAllowedError');let entry=this.entriesMap.get(name);if(!entry&&options?.create){entry=new MemoryFile(name,this.owner);this.entriesMap.set(name,entry);}if(!entry)throw new DOMException('missing','NotFoundError');if(entry.kind!=='file')throw new DOMException('wrong kind','TypeMismatchError');return entry;}
 async removeEntry(name:string){if(!this.entriesMap.delete(name))throw new DOMException('missing','NotFoundError');}
 async *values(){yield* this.entriesMap.values();}
 async isSameEntry(other:unknown){return other===this;}
 asHandle(){return this as unknown as FileSystemDirectoryHandle;}
}
export class MemoryFile {
 readonly kind='file';bytes=new Uint8Array();
 constructor(public name:string,private root:MemoryDirectory){}
 async getFile(){return new File([this.bytes],this.name,{lastModified:1234});}
 async createWritable(){let bytes=this.bytes;return {write:async(value:any)=>{bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value instanceof Blob?await value.arrayBuffer():value);},close:async()=>{if(this.root.failWrite===this.name){this.root.failWrite=null;throw new DOMException('disk full','QuotaExceededError');}this.bytes=bytes;}};}
 async isSameEntry(other:unknown){return other===this;}
}

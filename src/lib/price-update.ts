export function parsePurchasePrice(input:string):number {
 if(!/^\d+$/.test(input))throw new Error('Enter a whole-dollar purchase price.');
 const price=Number(input);
 if(!Number.isSafeInteger(price)||price<0||price>100000000000000)throw new Error('Purchase price is out of range.');
 return price;
}
export async function validatePriceScreenshot(file:Pick<File,'size'|'type'|'slice'>):Promise<string>{
 if(file.size<1||file.size>5*1024*1024)throw new Error('Screenshot must be between 1 byte and 5 MB.');
 const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png=b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
 const jpg=b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255;
 const webp=b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
 if(file.type==='image/png'&&png)return 'png';
 if(file.type==='image/jpeg'&&jpg)return 'jpg';
 if(file.type==='image/webp'&&webp)return 'webp';
 throw new Error('Attach a real PNG, JPG or WebP screenshot.');
}

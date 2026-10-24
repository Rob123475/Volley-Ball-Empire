// The installer's crop (centre square, 500x500 lanczos3) written losslessly, for cleaning.
const fs=require('fs'),path=require('path');
const sharp=require('C:/vbe-tm/scripts/node_modules/sharp');
const SRC='C:/Users/rbonn/OneDrive/Desktop/staff portraits 1.1.2';
const OUT=process.argv[2];
const roles={'head coach':'hc','assistant coach':'ac','scouts':'sc'};
(async()=>{const index=[];
for(const [dir,tag] of Object.entries(roles)){
  const files=fs.readdirSync(path.join(SRC,dir)).filter(f=>/\.png$/i.test(f)).sort();
  fs.mkdirSync(path.join(OUT,'orig'),{recursive:true});
  for(let i=0;i<files.length;i++){
    const input=fs.readFileSync(path.join(SRC,dir,files[i]));
    const m=await sharp(input).metadata(); const side=Math.min(m.width,m.height);
    const left=Math.round((m.width-side)/2), top=m.height>m.width?Math.round((m.height-side)*0.1):0;
    const id=`${tag}${String(i+1).padStart(2,'0')}`;
    await sharp(input).extract({left,top,width:side,height:side}).resize(500,500,{kernel:'lanczos3'}).png().toFile(path.join(OUT,'orig',id+'.png'));
    index.push({id,dir,file:files[i]});
  }}
fs.writeFileSync(path.join(OUT,'index.json'),JSON.stringify(index,null,1));
console.log(index.length);})();

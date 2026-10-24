# zoom.py out.jpg "id:x,y,w,h;..."  -> before | after zooms side by side
import cv2,numpy as np,sys,os
D=os.path.dirname(os.path.abspath(__file__)).replace(chr(92),'/')
rows=[]
for part in sys.argv[2].split(';'):
    i,r=part.split(':'); x,y,w,h=map(int,r.split(','))
    s=max(1,min(6,int(480/max(w,h))))
    pair=[]
    for src in ('orig','out'):
        im=cv2.imread(f'{D}/{src}/{i}.png'); c=im[y:y+h,x:x+w]
        pair.append(cv2.resize(c,None,fx=s,fy=s,interpolation=cv2.INTER_CUBIC))
    z=np.hstack([pair[0],np.full((pair[0].shape[0],6,3),255,np.uint8),pair[1]])
    z=cv2.copyMakeBorder(z,16,4,0,0,cv2.BORDER_CONSTANT,value=(255,255,255)); cv2.putText(z,f'{i} [{x},{y},{w},{h}] before | after',(3,12),0,0.4,(0,0,0),1)
    rows.append(z)
W=max(r.shape[1] for r in rows); rows=[cv2.copyMakeBorder(r,0,0,0,W-r.shape[1],cv2.BORDER_CONSTANT,value=(255,255,255)) for r in rows]
cv2.imwrite(sys.argv[1],np.vstack(rows),[cv2.IMWRITE_JPEG_QUALITY,90])

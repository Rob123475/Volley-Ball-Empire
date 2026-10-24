# pairs.py prefix ids : before|after at T px, 3 pairs per row, 5 rows per sheet
import cv2,numpy as np,sys,os
D=os.path.dirname(os.path.abspath(__file__)).replace(chr(92),'/'); T=int(os.environ.get('T','220'))
ids=sys.argv[2].split(','); tiles=[]
for i in ids:
    p=[cv2.resize(cv2.imread(f'{D}/{s}/{i}.png'),(T,T),interpolation=cv2.INTER_AREA) for s in ('orig','out')]
    t=np.hstack([p[0],np.full((T,3,3),255,np.uint8),p[1]]); t=cv2.copyMakeBorder(t,14,4,0,10,cv2.BORDER_CONSTANT,value=(255,255,255)); cv2.putText(t,i,(2,11),0,0.4,(0,0,0),1); tiles.append(t)
C=int(os.environ.get('C','3')); R=int(os.environ.get('R','5'))
while len(tiles)%C: tiles.append(np.full_like(tiles[0],255))
rows=[np.hstack(tiles[r:r+C]) for r in range(0,len(tiles),C)]
for s in range(0,len(rows),R): cv2.imwrite(f'{sys.argv[1]}_{s//R}.jpg',np.vstack(rows[s:s+R]),[cv2.IMWRITE_JPEG_QUALITY,88])

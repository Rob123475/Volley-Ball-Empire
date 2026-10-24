# walls.py : for each scout, the wall region right of the person (x>=X0, y<=Y1, away from anything sharp or dark),
# added to boxes.json as a 19 Oct 'wall' polygon (smooth surface fit, feathered).
import cv2,numpy as np,json
B=json.load(open('boxes.json')); X0,Y1=380,290
E=lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k))
masks=[]
for k in sorted(B):
    if not k.startswith('sc'): continue
    im=cv2.imread(f'orig/{k}.png'); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32)
    lap=np.abs(cv2.Laplacian(cv2.GaussianBlur(g,(0,0),1.0),cv2.CV_32F))
    sharp=cv2.GaussianBlur(lap,(0,0),4)>2.2
    dark=cv2.GaussianBlur(g,(0,0),2)<40
    person=(sharp|dark).astype(np.uint8)
    # keep only big person blobs (connected to the bottom or large), so blurred background speckle doesn't count
    n,lb,st,_=cv2.connectedComponentsWithStats(person)
    keep=np.zeros_like(person)
    for i in range(1,n):
        if st[i,4]>800: keep[lb==i]=1
    person=cv2.dilate(keep,E(29))
    reg=np.zeros_like(person); reg[:Y1,X0:]=1; reg&=(person==0)
    reg=cv2.morphologyEx(reg,cv2.MORPH_OPEN,E(15))
    cs,_=cv2.findContours(reg,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    B[k]=[b for b in B[k] if not (isinstance(b,dict) and b.get('wall'))]
    if cs:
        c=max(cs,key=cv2.contourArea)
        if cv2.contourArea(c)>3000:
            p=cv2.approxPolyDP(c,2,True).reshape(-1,2).tolist()
            B[k].append({"poly":p,"wall":1,"useint":1,"ring":8,"keep":60})
    v=im.copy(); v[reg>0]=(v[reg>0]*0.5+np.array([0,0,255])*0.5).astype(np.uint8)
    v[(person>0)&(np.arange(500)[None,:]>=X0)&(np.arange(500)[:,None]<Y1)]//=2
    cv2.putText(v,k,(5,20),0,0.6,(255,255,255),2); masks.append(cv2.resize(v,(250,250)))
json.dump(B,open('boxes.json','w'),indent=0)
while len(masks)%6: masks.append(np.zeros_like(masks[0]))
rows=[np.hstack(masks[i:i+6]) for i in range(0,len(masks),6)]
for s in range(0,len(rows),4): cv2.imwrite(f'g/wallmask_{s//4}.jpg',np.vstack(rows[s:s+4]))
print('done')

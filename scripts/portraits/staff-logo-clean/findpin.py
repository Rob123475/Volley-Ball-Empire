# Locate the gold lapel pin on each scout: a compact gold blob on the jacket (lower 60% of the picture).
import cv2,numpy as np,json
res={}
for n in range(1,62):
    i='sc%02d'%n; im=cv2.imread(f'orig/{i}.png'); lab=cv2.cvtColor(im,cv2.COLOR_BGR2LAB).astype(int)
    L,a,b=lab[...,0],lab[...,1]-128,lab[...,2]-128
    m=((b>22)&(a>-2)&(a<30)&(L>70)).astype(np.uint8); m[:320]=0; m[:,445:]=0
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    nb,lb,st,cen=cv2.connectedComponentsWithStats(m)
    c=[(st[k,4],k) for k in range(1,nb) if 200<st[k,4]<1000 and 16<=st[k,2]<=36 and 16<=st[k,3]<=36 and st[k,4]>0.35*st[k,2]*st[k,3]]
    if not c: res[i]=None; continue
    k=max(c)[1]; x,y,w,h=st[k,:4]; res[i]=[int(x),int(y),int(w),int(h),int(st[k,4])]
for k,v in res.items(): print(k,v)
json.dump(res,open('pins.json','w'))

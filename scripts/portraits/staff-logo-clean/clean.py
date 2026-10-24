import cv2,numpy as np,json,sys,os
BK=os.path.dirname(os.path.abspath(__file__)).replace(chr(92),'/')+'/orig/'
L=None
E=lambda k: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(max(1,k),max(1,k)))

def parse(box):
    if isinstance(box,dict):
        o=box; P=np.array(box['poly'],np.int32)
    else:
        x,y,w,h=box[:4]; o=box[4] if len(box)>4 else {}
        P=np.array([[x,y],[x+w-1,y],[x+w-1,y+h-1],[x,y+h-1]],np.int32)
    return P,o

def lerp_box(img,box,dbg=None):
    H,W=img.shape[:2]; x,y,w,h=box[:4]; o=box[4]
    x0,y0,x1,y1=max(0,x),max(0,y),min(W,x+w),min(H,y+h)
    sl=o.get('slope',0.0); side=o.get('side','both')
    if side!='v':
        if x0==0: side='r'
        if x1==W: side='l'
    lx=o.get('lx',x0-2); rx=o.get('rx',x1+1)
    src=cv2.GaussianBlur(img,(0,0),o.get('lsm',1.0)).astype(np.float32)
    out=img.astype(np.float32).copy()
    def samp(xx,yy):
        yy=min(max(int(round(yy)),0),H-1); xx=min(max(int(xx),0),W-1)
        return src[yy,xx]
    for yy in range(y0,y1):
        for xx in range(x0,x1):
            if side=='v':
                T_=samp(xx,y0-2); B_=samp(xx,y1+1); t=(yy-y0+0.5)/(y1-y0); v=T_*(1-t)+B_*t
                if y0==0: v=B_
                if y1==H: v=T_
            else:
                L_=samp(lx,yy-sl*(xx-lx)); R_=samp(rx,yy+sl*(rx-xx))
                t=(xx-x0+0.5)/(x1-x0)
                v=L_ if side=='l' else R_ if side=='r' else L_*(1-t)+R_*t
            out[yy,xx]=v
    reg=out[y0:y1,x0:x1]
    Y0,X0=max(0,y0-8),max(0,x0-8)
    res=img[Y0:y1+8,X0:x1+8].astype(np.float32)
    hp=np.abs(res-cv2.GaussianBlur(res,(0,0),1.5)).mean(2)
    om=np.ones(hp.shape,bool); om[y0-Y0:y1-Y0,x0-X0:x1-X0]=False
    sd=np.median(hp[om])*1.4826*o.get('grain',0.6) if om.sum()>20 else 1.0
    rng=np.random.default_rng(x0*7+y0); n=cv2.GaussianBlur(rng.normal(0,1,reg.shape[:2]).astype(np.float32),(0,0),0.7); n/=n.std()+1e-6
    reg+=n[...,None]*sd
    a=np.ones(reg.shape[:2],np.float32); f=o.get('feath',2)
    for k in range(f):
        wgt=(k+1)/(f+1)
        if y0>0: a[k,:]=np.minimum(a[k,:],wgt)
        if y1<H: a[-1-k,:]=np.minimum(a[-1-k,:],wgt)
    hf=o.get('hf',0)
    for k in range(hf):
        wgt=(k+1)/(hf+1)
        if x0>0 and 'l' in o.get('hfs','lr'): a[:,k]=np.minimum(a[:,k],wgt)
        if x1<W and 'r' in o.get('hfs','lr'): a[:,-1-k]=np.minimum(a[:,-1-k],wgt)
    if 'clip' in o:
        PMc=np.zeros(a.shape,np.uint8); cv2.fillPoly(PMc,[np.array(o['clip'],np.int32)-[x0,y0]],255)
        a=a*cv2.GaussianBlur(PMc.astype(np.float32)/255,(0,0),0.8)
    a=a[...,None]
    img[y0:y1,x0:x1]=np.clip(img[y0:y1,x0:x1]*(1-a)+reg*a+0.5,0,255).astype(np.uint8)
    if dbg is not None:
        M=np.zeros((y1-y0,x1-x0),np.uint8)+255; dbg.append((x0,y0,M,np.zeros_like(M),M))
    return img

def open_box(img,box,dbg=None):
    # remove light text on a dark strip: morphological opening along the strip direction, darken-only
    H,W=img.shape[:2]
    P,o=parse(box)
    bx0,by0=P.min(0); bx1,by1=P.max(0)+1
    k=o.get('k',41); sl=o.get('slope',0.0); m=k+int(abs(sl)*W)+10
    cx0,cy0,cx1,cy1=max(0,bx0-m),max(0,by0-m),min(W,bx1+m),min(H,by1+m)
    crop=img[cy0:cy1,cx0:cx1].astype(np.float32); ch,cw=crop.shape[:2]
    gy,gx=np.mgrid[0:ch,0:cw].astype(np.float32)
    shy=(gy+sl*(gx-float(bx0-cx0))).astype(np.float32)
    sh=cv2.remap(crop,gx,shy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    sh=cv2.GaussianBlur(sh,(0,0),o.get('pre',1.0))
    if o.get('maskout'):
        PM0=np.zeros((ch,cw),np.float32); cv2.fillPoly(PM0,[P-[cx0,cy0]],1.0)
        PMs=cv2.remap(PM0,gx,shy,cv2.INTER_LINEAR)
        inm=PMs>0.5; shf=sh.copy() if not o.get('zfill') else sh*inm[...,None]
        for r in (range(ch) if not o.get('zfill') else []):
            row=inm[r]
            if row.sum()>=3:
                lum=sh[r][row].mean(1); q=np.percentile(lum,o.get('rowq',15))
                v=sh[r][row][lum<=q].mean(0) if (lum<=q).any() else sh[r][row].mean(0)
                shf[r][~row]=v
            else: shf[r]=sh[r]
        sh=shf
    pad=k
    shp=cv2.copyMakeBorder(sh,0,0,pad,pad,cv2.BORDER_REPLICATE) if (o.get('maskout') and not o.get('zfill')) else cv2.copyMakeBorder(sh,0,0,pad,pad,cv2.BORDER_CONSTANT,value=(0,0,0)) if o.get('darkborder',1) else cv2.copyMakeBorder(sh,0,0,pad,pad,cv2.BORDER_REPLICATE)
    ker=np.ones((o.get('kv',1),k),np.uint8)
    op=cv2.dilate(cv2.erode(shp,ker),ker)[:,pad:-pad]
    if o.get('maskout'):
        sh0=cv2.GaussianBlur(cv2.remap(crop,gx,shy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE),(0,0),o.get('pre',1.0))
        op=np.where((PMs>0.5)[...,None],op,sh0)
    op=cv2.GaussianBlur(op,(0,0),o.get('post',1.2))
    unshy=(gy-sl*(gx-float(bx0-cx0))).astype(np.float32)
    filt=cv2.remap(op,gx,unshy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    PM=np.zeros((ch,cw),np.uint8); cv2.fillPoly(PM,[P-[cx0,cy0]],255)
    reg=cv2.GaussianBlur(PM.astype(np.float32)/255,(0,0),o.get('feath',1.5))
    lo=cv2.cvtColor(np.clip(crop,0,255).astype(np.uint8),cv2.COLOR_BGR2LAB)[...,0].astype(np.float32)
    lf=cv2.cvtColor(np.clip(filt,0,255).astype(np.uint8),cv2.COLOR_BGR2LAB)[...,0].astype(np.float32)
    dk=np.clip((lo-lf-o.get('dz',2))/o.get('dr',6),0,1)
    dk=cv2.GaussianBlur(dk,(0,0),1.0)
    if o.get('chroma',0):
        cl=cv2.cvtColor(np.clip(crop,0,255).astype(np.uint8),cv2.COLOR_BGR2LAB).astype(np.float32)
        inr=PM>0; lv=cl[...,0][inr]; sel=inr&(cl[...,0]<=np.percentile(lv,o.get('bpct',20)))
        abm=np.median(cl[sel][:,1:],0)
        fl=cv2.cvtColor(np.clip(filt,0,255).astype(np.uint8),cv2.COLOR_BGR2LAB).astype(np.float32)
        w_=dk[...,None]
        fl[...,1:]=fl[...,1:]*(1-w_)+abm*w_
        filt=cv2.cvtColor(np.clip(fl,0,255).astype(np.uint8),cv2.COLOR_LAB2BGR).astype(np.float32)
    rng=np.random.default_rng(int(cx0)*7+int(cy0)); n=cv2.GaussianBlur(rng.normal(0,1,(ch,cw)).astype(np.float32),(0,0),0.7); n/=n.std()+1e-6
    hp=np.abs(crop-cv2.GaussianBlur(crop,(0,0),1.5)).mean(2); sd=np.median(hp)*1.4826*o.get('grain',0.6)
    filt=filt+n[...,None]*sd
    a=(reg*dk)[...,None]
    out=crop*(1-a)+filt*a
    img[cy0:cy1,cx0:cx1]=np.clip(out+0.5,0,255).astype(np.uint8)
    if dbg is not None: dbg.append((cx0,cy0,((reg*dk)>0.3).astype(np.uint8)*255,np.zeros((ch,cw),np.uint8),PM))
    return img

def wall_box(img,box,dbg=None):
    # out-of-focus wall emblem: replace polygon with a smooth robust surface fit (ring + interior, emblem rejected)
    H,W=img.shape[:2]; P,o=parse(box)
    m=o.get('ring',24)
    bx0,by0=P.min(0); bx1,by1=P.max(0)+1
    cx0,cy0,cx1,cy1=max(0,bx0-m),max(0,by0-m),min(W,bx1+m),min(H,by1+m)
    crop=img[cy0:cy1,cx0:cx1].astype(np.float32); ch,cw=crop.shape[:2]
    PM=np.zeros((ch,cw),np.uint8); cv2.fillPoly(PM,[P-[cx0,cy0]],255)
    EX=np.zeros((ch,cw),np.uint8)
    for q in o.get('excl',[]): cv2.fillPoly(EX,[np.array(q,np.int32)-[cx0,cy0]],255)
    ring=(cv2.dilate(PM,E(2*m+1))>0)&(PM==0)&(EX==0)
    use=ring.copy()
    if o.get('useint',0): use|=(PM>0)
    yy,xx=np.nonzero(use)
    deg=o.get('deg',2)
    def feats(yv,xv):
        X=xv/100.0; Y=yv/100.0; f=[np.ones_like(X),X,Y]
        if deg>=2: f+=[X*X,X*Y,Y*Y]
        if deg>=3: f+=[X**3,X*X*Y,X*Y*Y,Y**3]
        return np.column_stack(f)
    A=feats(yy.astype(np.float32),xx.astype(np.float32)); v=crop[yy,xx]
    w=np.ones(len(yy),bool)
    for it in range(4):
        coef,_,_,_=np.linalg.lstsq(A[w],v[w],rcond=None)
        r=np.abs(A@coef-v).sum(1); w=r<np.percentile(r[w],o.get('keep',70))*1.8+2
    gy,gx=np.mgrid[0:ch,0:cw]
    fit=(feats(gy.ravel().astype(np.float32),gx.ravel().astype(np.float32))@coef).reshape(ch,cw,3)
    rng=np.random.default_rng(int(cx0)*7+int(cy0)); n=cv2.GaussianBlur(rng.normal(0,1,(ch,cw)).astype(np.float32),(0,0),0.8); n/=n.std()+1e-6
    hp=np.abs(crop-cv2.GaussianBlur(crop,(0,0),1.5)).mean(2); sd=np.median(hp[ring])*1.4826*o.get('grain',0.8) if ring.any() else 1.0
    fit=fit+n[...,None]*sd
    a=cv2.GaussianBlur(PM.astype(np.float32)/255,(0,0),o.get('feather',6))
    a=np.where(cv2.erode(PM,E(int(o.get('feather',6))*2+1))>0,1.0,a)[...,None]
    out=crop*(1-a)+fit*a
    img[cy0:cy1,cx0:cx1]=np.clip(out+0.5,0,255).astype(np.uint8)
    if dbg is not None: dbg.append((cx0,cy0,PM,(ring*255).astype(np.uint8),PM))
    return img

def hole_box(img,box,dbg=None):
    # defocused wall emblem: holes (darker blobs) inside the lighter wall area are inpainted and smoothed
    H,W=img.shape[:2]; P,o=parse(box)
    bx0,by0=P.min(0); bx1,by1=P.max(0)+1; m=30
    cx0,cy0,cx1,cy1=max(0,bx0-m),max(0,by0-m),min(W,bx1+m),min(H,by1+m)
    crop=img[cy0:cy1,cx0:cx1].copy(); ch,cw=crop.shape[:2]
    PM=np.zeros((ch,cw),np.uint8); cv2.fillPoly(PM,[P-[cx0,cy0]],255); inside=PM>0
    lab=cv2.cvtColor(crop,cv2.COLOR_BGR2LAB).astype(np.float32)
    Lb=cv2.GaussianBlur(lab[...,0],(0,0),2)
    v=Lb[inside].astype(np.uint8)
    thr,_=cv2.threshold(v.reshape(-1,1),0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    thr=o.get('thr',thr+o.get('dthr',0))
    light=((Lb>thr)&inside).astype(np.uint8)*255
    closed=cv2.morphologyEx(light,cv2.MORPH_CLOSE,E(o.get('ck',61)))
    hole=((closed>0)&(light==0)&inside).astype(np.uint8)
    # also fill enclosed holes of the light region
    nb,lb=cv2.connectedComponents((light==0).astype(np.uint8),connectivity=4)
    pad=cv2.copyMakeBorder(PM,1,1,1,1,cv2.BORDER_CONSTANT,value=0)
    if cy0==0: pad[0,:]=255
    if cy1==H: pad[-1,:]=255
    if cx0==0: pad[:,0]=255
    if cx1==W: pad[:,-1]=255
    edge=(PM>0)&(cv2.erode(pad,E(3))[1:-1,1:-1]==0)
    for k in range(1,nb):
        comp=lb==k
        if not (comp&inside).any(): continue
        if (comp&edge).any() or (comp&~inside).any(): continue
        hole[comp]=1
    n2,l2,st2,_=cv2.connectedComponentsWithStats(hole,connectivity=8)
    H2=np.zeros_like(hole)
    for k in range(1,n2):
        comp=l2==k
        if st2[k,4]<o.get('minarea',30): continue
        if (comp&edge).any() and not o.get('edgeok'): continue
        H2[comp]=1
    M=cv2.dilate(H2*255,E(2*o.get('dil',6)+1)); M[~inside]=0
    for q in o.get('add',[]):
        cv2.fillPoly(M,[np.array(q,np.int32)-[cx0,cy0]],255)
    fill=cv2.inpaint(crop,M,o.get('rad',15),cv2.INPAINT_TELEA).astype(np.float32)
    fb=cv2.GaussianBlur(fill,(0,0),o.get('sm',8))
    mf=cv2.GaussianBlur(M.astype(np.float32)/255,(0,0),o.get('sm',8))[...,None]
    fill=np.where(mf>0.05,fb/np.maximum(1e-3,1.0),fill)  # smoothed fill
    rng=np.random.default_rng(int(cx0)*7+int(cy0)); n=cv2.GaussianBlur(rng.normal(0,1,(ch,cw)).astype(np.float32),(0,0),0.8); n/=n.std()+1e-6
    hp=np.abs(crop.astype(np.float32)-cv2.GaussianBlur(crop.astype(np.float32),(0,0),1.5)).mean(2)
    sd=np.median(hp[inside&(M==0)])*1.4826*o.get('grain',0.8) if (inside&(M==0)).any() else 1.0
    fill=fill+n[...,None]*sd
    a=cv2.GaussianBlur(M.astype(np.float32)/255,(0,0),o.get('feather',4))
    a=np.where(cv2.erode(M,E(9))>0,1.0,a)[...,None]
    out=crop.astype(np.float32)*(1-a)+fill*a
    img[cy0:cy1,cx0:cx1]=np.clip(out+0.5,0,255).astype(np.uint8)
    if dbg is not None: dbg.append((cx0,cy0,M,light,PM))
    return img

def clean_box(img, box, dbg=None):
    H,W=img.shape[:2]
    if isinstance(box,dict) and box.get('hole'): return hole_box(img,box,dbg)
    if isinstance(box,dict) and box.get('wall'): return wall_box(img,box,dbg)
    if isinstance(box,dict) and box.get('open'): return open_box(img,box,dbg)
    if isinstance(box,list) and len(box)>4 and box[4].get('open'): return open_box(img,box,dbg)
    if isinstance(box,list) and len(box)>4 and box[4].get('lerp'): return lerp_box(img,box,dbg)
    P,o=parse(box)
    strict=isinstance(box,dict)
    g=o.get('grow',0 if strict else 30)
    bx0,by0=P.min(0); bx1,by1=P.max(0)+1
    # search window (box grown by g) and context window (+20)
    sx0,sy0,sx1,sy1=max(0,bx0-g),max(0,by0-g),min(W,bx1+g),min(H,by1+g)
    cx0,cy0,cx1,cy1=max(0,sx0-20),max(0,sy0-20),min(W,sx1+20),min(H,sy1+20)
    crop=img[cy0:cy1,cx0:cx1].copy(); ch,cw=crop.shape[:2]
    PM=np.zeros((ch,cw),np.uint8); cv2.fillPoly(PM,[P-[cx0,cy0]],255); inbox=PM>0
    SW=np.zeros((ch,cw),bool); SW[sy0-cy0:sy1-cy0,sx0-cx0:sx1-cx0]=True
    # frame of search window (only sides not on the image border)
    fr=np.zeros((ch,cw),bool); b=2
    ys,ye,xs,xe=sy0-cy0,sy1-cy0,sx0-cx0,sx1-cx0
    if sy0>0: fr[ys:ys+b,xs:xe]=True
    if sy1<H: fr[ye-b:ye,xs:xe]=True
    if sx0>0: fr[ys:ye,xs:xs+b]=True
    if sx1<W: fr[ys:ye,xe-b:xe]=True
    if strict:  # polygon: the polygon itself is the search window
        SW=inbox.copy()
        pad=cv2.copyMakeBorder(PM,1,1,1,1,cv2.BORDER_CONSTANT,value=0)
        fr=(inbox&(cv2.erode(pad,E(5))[1:-1,1:-1]==0))
    lab=cv2.cvtColor(crop,cv2.COLOR_BGR2LAB).astype(np.float32)
    est=cv2.medianBlur(crop,o.get('med',17)|1)
    le=cv2.cvtColor(est,cv2.COLOR_BGR2LAB).astype(np.float32)
    d=np.sqrt(((lab-le)**2).sum(2))
    N=np.zeros((ch,cw),np.uint8)
    if o.get('blue'):
        bl=((lab[...,2]<128-o['blue'])&(lab[...,0]>o.get('bluel',60))).astype(np.uint8)
        n3,lb3,st3,_=cv2.connectedComponentsWithStats(bl,connectivity=8)
        for k in range(1,n3):
            if st3[k,4]>=o.get('skymin',40): N[lb3==k]=255
    Nd=cv2.dilate(N,E(o.get('nd',3)))
    if o.get('tmask'):
        Lc,ac,bc=lab[...,0],lab[...,1]-128,lab[...,2]-128
        if o['tmask']=='yellow': T=(bc>o.get('tb',14))&(ac<o.get('ta',14))&(Lc>o.get('tl',60))
        else: T=(np.abs(ac)<o.get('tc',10))&(bc>o.get('tbw',-6))&(Lc>o.get('tl',120))
        M=(T&inbox).astype(np.uint8)*255
        M=cv2.morphologyEx(M,cv2.MORPH_CLOSE,E(3))
        M=cv2.dilate(M,E(2*o.get('dil',2)+1)); M[~inbox]=0
    elif o.get('mode')=='all':
        M=inbox.astype(np.uint8)*255
    else:
        # fabric reference = dominant colour of low-detail pixels in the window
        sm=lab[SW&(d<8)]
        if len(sm)<30: sm=lab[SW]
        _,lbk,cen=cv2.kmeans(sm.astype(np.float32),min(3,len(sm)),None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,20,0.5),3,cv2.KMEANS_PP_CENTERS)
        ref=cen[np.bincount(lbk.ravel()).argmax()]
        CUT=np.zeros((ch,cw),np.uint8)
        for x1_,y1_,x2_,y2_,w_ in o.get('cut',[]):
            cv2.line(CUT,(x1_-cx0,y1_-cy0),(x2_-cx0,y2_-cy0),255,w_)
        m=((d>o.get('thr',22))&SW&(Nd==0)&(CUT==0)).astype(np.uint8)
        n,lb,st,_=cv2.connectedComponentsWithStats(m,connectivity=8)
        touch=set(np.unique(lb[fr]))
        hit=set(np.unique(lb[inbox]))
        inb2=cv2.dilate(inbox.astype(np.uint8),E(o.get('bpad',17)))>0
        cand=[]
        for k in range(1,n):
            if k in touch or k not in hit: continue
            if st[k,4]<o.get('minarea',3): continue
            pk=(lb==k)
            if (pk&inb2).sum()<o.get('infrac',0.6)*st[k,4]: continue
            if not o.get('nothin') and st[k,4]>=12:
                ys_,xs_=np.nonzero(pk); (_,_),(rw,rh),_=cv2.minAreaRect(np.column_stack([xs_,ys_]).astype(np.float32))
                lo,hi=min(rw,rh),max(rw,rh)
                if hi>28 and lo<=11 and hi>4.5*max(lo,1) and st[k,4]<0.5*hi*hi/4: continue   # long thin stroke: lanyard/cord
            cand.append((k,lab[pk].mean(0),st[k,4]))
        pol=o.get('pol')
        if pol is None and cand:
            sg=sum((c[1][0]-ref[0])*c[2] for c in cand)
            pol='light' if sg>=0 else 'dark'
        o=dict(o); o['pol']=pol or 'light'
        keep=np.zeros(n,bool)
        for k,mc,ar in cand:
            if pol=='light' and mc[0]<ref[0]+2 and np.hypot(mc[1]-ref[1],mc[2]-ref[2])<25: continue
            if pol=='dark' and mc[0]>ref[0]-2 and np.hypot(mc[1]-ref[1],mc[2]-ref[2])<25: continue
            keep[k]=True
        M=(keep[lb]).astype(np.uint8)*255
        # region grow: absorb weaker-contrast parts of the mark adjacent to it (e.g. blue swirl segments on navy)
        if o.get('gt',12)<999 and M.any():
            dist=np.sqrt(((lab-ref)**2).sum(2))
            G=(dist>o.get('gt',12))&SW&(Nd==0)
            pol=o.get('pol','light')
            if pol=='light': G&=lab[...,0]>=ref[0]-3
            if pol=='dark': G&=lab[...,0]<=ref[0]+3
            lim=cv2.dilate(M,E(o.get('glim',15)))>0
            for _ in range(8):
                M2=((cv2.dilate(M,E(3))>0)&G&lim).astype(np.uint8)*255
                M2=np.maximum(M,M2)
                if (M2!=M).sum()==0: break
                M=M2
        ck=o.get('close',7)
        M=cv2.morphologyEx(M,cv2.MORPH_CLOSE,E(ck))
        nb,lbb=cv2.connectedComponents((M==0).astype(np.uint8),connectivity=4)
        bgl=set(np.unique(lbb[(fr|~SW)&(M==0)]))-{0}
        if bgl: M=np.where(np.isin(lbb,list(bgl)),0,255).astype(np.uint8)
        dl=o.get('dil',3)
        M=cv2.dilate(M,E(2*dl+1))
        e=dl+3
        if cy1==H and ch>e+1: M[-e:,:]=np.maximum(M[-e:,:],M[-e-1:-e,:])
        if cx1==W and cw>e+1: M[:,-e:]=np.maximum(M[:,-e:],M[:,-e-1:-e])
        if cx0==0 and cw>e+1: M[:,:e]=np.maximum(M[:,:e],M[:,e:e+1])
        if strict: M[~inbox]=0
    if o.get('cut') and o.get('mode')!='all': M[CUT>0]=0
    for r in o.get('ko',[]):
        rx,ry,rw,rh=r; M[max(0,ry-cy0):max(0,ry-cy0+rh),max(0,rx-cx0):max(0,rx-cx0+rw)]=0
    M=np.where(Nd>0,0,M).astype(np.uint8)
    src_mask=np.maximum(M,Nd)
    if strict and o.get('mode')=='all' and o.get('fabtol',40)<999:
        ring=(cv2.dilate(M,E(13))>0)&(M==0)
        rl=lab[ring].astype(np.float32)
        _,lbk,cen=cv2.kmeans(rl,3,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,20,0.5),3,cv2.KMEANS_PP_CENTERS)
        fref=cen[np.bincount(lbk.ravel()).argmax()] if 'fabpt' not in o else np.median(cv2.cvtColor(img[o['fabpt'][1]-2:o['fabpt'][1]+3,o['fabpt'][0]-2:o['fabpt'][0]+3],cv2.COLOR_BGR2LAB).reshape(-1,3).astype(np.float32),0)
        fd=np.sqrt(((lab-fref)**2).sum(2))
        tol=o.get('fabtol',40)
        sky=(fd>tol)&(lab[...,2]<o.get('skyb',106))&(lab[...,1]<o.get('skya',145))&(lab[...,0]>o.get('skyl',100))
        inner=cv2.erode(PM,E(o.get('inner',9)))>0
        ls=lab[inner&(fd>tol)].astype(np.float32)
        if len(ls)>=10:
            _,_,lc=cv2.kmeans(ls,min(3,len(ls)),None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,20,0.5),3,cv2.KMEANS_PP_CENTERS)
            dl_=np.min(np.stack([np.sqrt(((lab-c)**2).sum(2)) for c in lc]),0)
            other=(fd>tol)&(dl_>o.get('logotol',35))
        else: other=(fd>tol)
        ball=(sky|other).astype(np.uint8)
        nb_,lb_=cv2.connectedComponents(ball,connectivity=4)
        outs=set(np.unique(lb_[(ball>0)&(PM==0)]))-{0}
        ext=np.isin(lb_,list(outs))&(ball>0)
        ext=cv2.dilate(ext.astype(np.uint8),E(o.get('extd',3)))>0
        M[ext]=0
        bad=((fd>o.get('fabtol',40))&(M==0)).astype(np.uint8)*255
        src_mask=np.maximum(src_mask,cv2.dilate(bad,E(3)))
        Nd=bad
    fill=cv2.inpaint(crop,src_mask,o.get('rad',6),cv2.INPAINT_NS if o.get('ns',1) else cv2.INPAINT_TELEA)
    if o.get('sm',1.2)>0: fill=cv2.GaussianBlur(fill,(0,0),o.get('sm',1.2))
    if o.get('tmask') and o.get('flat',1):
        cand=(M==0)&inbox
        Ls=lab[...,0][cand]
        if Ls.size>20:
            thr_=np.percentile(Ls,o.get('bpct',30))
            sel=cand&(lab[...,0]<=thr_)
            col=np.median(crop[sel].reshape(-1,3),0)
            # vertical gradient of banner colour: fit per-row median along the box
            fill=np.zeros_like(fill,dtype=np.float32)+col.astype(np.float32)
    if 'flatcol' in o:
        fill=np.zeros_like(fill,dtype=np.float32)+np.array(o['flatcol'],np.float32)
    elif o.get('flatpt')=='dark':
        pix=crop[inbox].reshape(-1,3).astype(np.float32); lum=pix.mean(1)
        col=np.median(pix[lum<=np.percentile(lum,o.get('dpct',30))],0)
        fill=np.zeros_like(fill,dtype=np.float32)+col
    elif 'flatpt' in o:
        fx,fy=o['flatpt']; col=np.median(img[fy-3:fy+4,fx-3:fx+4].reshape(-1,3),0)
        fill=np.zeros_like(fill)+col.astype(fill.dtype)
    if o.get('fit'):
        ring=(cv2.dilate(M,E(o.get('ringw',21)))>0)&(src_mask==0)
        yy,xx=np.nonzero(ring)
        def feats(yv,xv):
            X=xv/50.0; Y=yv/50.0
            return np.column_stack([np.ones_like(X),X,Y,X*X,X*Y,Y*Y])
        A=feats(yy.astype(np.float32),xx.astype(np.float32)); vals=crop[yy,xx].astype(np.float32)
        w=np.ones(len(yy),bool)
        for it in range(3):
            coef,_,_,_=np.linalg.lstsq(A[w],vals[w],rcond=None)
            r=np.abs(A@coef-vals).sum(1); thr_=np.percentile(r[w],80)*1.5+3; w=r<thr_
        gy,gx=np.mgrid[0:ch,0:cw]
        fit=(feats(gy.ravel().astype(np.float32),gx.ravel().astype(np.float32))@coef).reshape(ch,cw,3)
        bl=o.get('fitmix',1.0)
        fill=(fit*bl+fill.astype(np.float32)*(1-bl))
    res=crop.astype(np.float32)-cv2.GaussianBlur(crop,(0,0),1.5).astype(np.float32)
    um=(src_mask==0)
    sd=np.median(np.abs(res[um]),0)*1.4826 if um.sum()>50 else np.array([2,2,2],np.float32)
    rng=np.random.default_rng(int(cx0)*7+int(cy0))
    noise=rng.normal(0,1,(ch,cw)).astype(np.float32)
    noise=cv2.GaussianBlur(noise,(0,0),0.7); noise/=noise.std()+1e-6
    fill=fill.astype(np.float32)+noise[...,None]*sd.mean()*o.get('grain',0.9)
    if o.get('feather'):
        fsig=o['feather']
        a=cv2.GaussianBlur(M.astype(np.float32)/255,(0,0),fsig)
        core=cv2.erode(M,E(int(2*fsig)*2+1))>0
        a=np.where(core,1.0,a)[...,None]
    else:
        a=cv2.GaussianBlur(M.astype(np.float32)/255,(0,0),0.8)
        a=np.where(M>0,1.0,a)[...,None]*(Nd==0)[...,None]
    out=crop.astype(np.float32)*(1-a)+fill*a
    img[cy0:cy1,cx0:cx1]=np.clip(out+0.5,0,255).astype(np.uint8)
    if dbg is not None: dbg.append((cx0,cy0,M,Nd if strict else N,PM))
    return img

def process(i, boxes, dbg=None):
    img=cv2.imread(BK+i+'.png')
    for bx in boxes: img=clean_box(img,bx,dbg)
    return img

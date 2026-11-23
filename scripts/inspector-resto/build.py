"""Inspector restoration atlas builder (writes public/game/models/inspector-resto.jpg).

The Mixamo inspector (inspector-mx.glb) carries one front photo projected onto the mesh, plus flat
colour swatches for every back-facing triangle. This script keeps the GLB untouched and paints a
two-panel atlas in the same orthographic frame (u = 0.5764x + 0.4727, v = 0.4980y + 0.0182):
  left  = the authentic front photo with the background halo removed (silhouette eroded, edge colours extended)
  right = a reconstructed back view built from the model's own material: cap pattern remapped from the
          front band, short hair fading into the nape, neck, thobe collar, vest with the two reflective
          bands sampled row-by-row from the front, and the thobe below.
mixamo-rig.js blends both panels in the shader by body side. Requires numpy, scipy, opencv-python, Pillow.
Usage:  python scripts/inspector-resto/build.py   (run from the repo root)
"""
import os,sys,io
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
MODELS=os.path.join(ROOT,'public','game','models')
import numpy as np,cv2
from scipy import ndimage as nd

# ---- GLB helpers
import json,struct
import numpy as np
CT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8,5122:np.int16}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(p):
    d=open(p,'rb').read()
    L=struct.unpack('<I',d[12:16])[0];j=json.loads(d[20:20+L])
    o=20+L;BL=struct.unpack('<I',d[o:o+4])[0];b=d[o+8:o+8+BL]
    return j,bytearray(b)
def acc(j,b,i):
    a=j['accessors'][i];bv=j['bufferViews'][a['bufferView']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0);n=NC[a['type']];dt=CT[a['componentType']]
    arr=np.frombuffer(bytes(b[off:off+a['count']*n*np.dtype(dt).itemsize]),dtype=dt).reshape(a['count'],n)
    if a.get('normalized'):arr=arr.astype(np.float32)/np.iinfo(dt).max
    return arr
def image(j,b):
    bv=j['bufferViews'][j['images'][0]['bufferView']];o=bv.get('byteOffset',0)
    return bytes(b[o:o+bv['byteLength']])

# ---- 0) extract the texture and rasterise the mesh silhouette in the projection frame
j,b=load(os.path.join(MODELS,'inspector-mx.glb'));p=j['meshes'][0]['primitives'][0]
from PIL import Image
Pm=acc(j,b,p['attributes']['POSITION']);Im=acc(j,b,p['indices']).ravel()
img=cv2.cvtColor(np.array(Image.open(io.BytesIO(image(j,b))).convert('RGB')),cv2.COLOR_RGB2BGR)
H0,W0=img.shape[:2]
pu=0.576440943*Pm[:,0]+0.47269741;pv=0.49804966*Pm[:,1]+0.01822525
sil=np.zeros((H0,W0),np.uint8)
for t in (np.c_[pu*W0,pv*H0][Im.reshape(-1,3)]*16).astype(np.int32): cv2.fillConvexPoly(sil,t,255,shift=4)
rng=np.random.default_rng(7)
H=img.shape[0];CW=930
F=np.flipud(img[:,:CW]).astype(np.float32).copy()
M=np.flipud(sil[:,:CW])>0
# ---- 1) front: remove background halo -> erode silhouette, extend inner colours outward
Mi=cv2.erode(M.astype(np.uint8),np.ones((5,5),np.uint8))>0
_,(iy,ix)=nd.distance_transform_edt(~Mi,return_indices=True)
Fc=F[iy,ix]
# soften the extended band slightly so it does not streak
blur=cv2.GaussianBlur(Fc,(0,0),3)
out=~Mi; Fc[out]=blur[out]
# ---- 2) back view, same projection frame (no mirroring keeps side seams continuous)
B=Fc.copy()
rows=np.arange(H)[:,None];cols=np.arange(CW)[None,:]
def span(r):
    c=np.where(M[r])[0];c=c[(c>250)&(c<700)]
    return (c.min(),c.max()) if len(c) else (469,470)
med=lambda a:np.median(a.reshape(-1,3),0)
skin=med(F[150:178,418:440])*0.5+med(F[150:178,500:522])*0.5
hair=med(F[205:225,445:495])  # beard tone
print('skin',skin,'hair',hair)
noise=rng.standard_normal((H,CW)).astype(np.float32)
strand=cv2.GaussianBlur(noise,(0,0),sigmaX=0.7,sigmaY=3.0)*2.2
fine=cv2.GaussianBlur(noise,(0,0),1.2)
CAP0,CAP1,HAIR1,NECK1,COL1,VEST1=38,130,192,224,238,648
def sstep(a,b,x): t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
for r in range(CAP0-4,COL1+2):
    a,b=span(r)
    if b<=a: continue
    cs=np.arange(max(a-6,0),min(b+7,CW))
    # cap: remap from the authentic front band (rows 44..112) keeping relative column position
    if r<CAP1+6:
        t=(r-CAP0)/(CAP1-CAP0);sr=int(np.clip(52+t*(112-52),52,112))
        sa,sb=span(sr)
        rel=(cs-a)/max(b-a,1);sc=np.clip((sa+rel*(sb-sa)).astype(int),0,CW-1)
        capc=Fc[sr,sc]
    else: capc=None
    # hair with strands, hairline fading into neck skin
    top=np.clip((r-CAP1)/(HAIR1-CAP1),0,1)          # 0 under the cap edge -> 1 at the nape
    hc=hair[None,:]*(1.12+0.18*top)*(1+0.16*strand[r,cs][:,None])
    # stubble: hair thins into skin over the nape instead of a hard band
    hc=hc*(1-0.35*top**2)+skin[None,:]*0.86*(0.35*top**2)
    edge=HAIR1+1.5*np.sin(cs*0.21)+2.5*cv2.GaussianBlur(noise,(0,0),2.0)[r,cs]*3
    wh=1-sstep(edge-12,edge+6,r)                      # 1=hair, 0=skin
    sk=skin[None,:]*(0.86+0.03*fine[r,cs][:,None])
    lower=hc*wh[:,None]+sk*(1-wh[:,None])
    if capc is not None:
        cedge=CAP1+2*np.sin(cs*0.11)
        wc=1-sstep(cedge-3,cedge+3,r)
        # soft shadow cast by the cap edge
        lower=lower*(1-0.35*np.clip(1-(r-cedge)/10,0,1)*(r>cedge))[:,None]
        px=capc*wc[:,None]+lower*(1-wc[:,None])
    else: px=lower
    # thobe collar band then vest
    if r>=NECK1-2:
        thobe=med(F[700:760,380:560])
        wcol=sstep(NECK1-2,NECK1+3,r)
        px=px*(1-wcol)+thobe[None,:]*wcol*(0.92+0.03*fine[r,cs][:,None])
    B[r,cs]=px
# vest back: clean yellow panel + the two authentic reflective bands and hem (row colours sampled from the front)
yel=np.median(F[490:530,520:560].reshape(-1,3),0)
band=lambda r:np.median(F[r,520:560].reshape(-1,3),0)
lowf=cv2.GaussianBlur(noise,(0,0),14)*6
for r in range(COL1-6,VEST1+5):
    a,b=span(r)
    cs=np.arange(max(a-6,0),min(b+7,CW))
    if 451<=r<=486 or 552<=r<=588 or r>=VEST1-1: col=band(r)
    else: col=yel
    x=(cs-469.5)/165.0
    shade=(1-0.10*np.clip(np.abs(x),0,1)**2)*(1+0.02*lowf[r,cs])
    w=sstep(COL1-6,COL1+2,r)
    vv=col[None,:]*shade[:,None]*(1+0.015*fine[r,cs][:,None])
    B[r,cs]=B[r,cs]*(1-w)+vv*w
# piping along the back neckline of the vest
for r in range(COL1-6,COL1+1):
    a,b=span(r);B[r,a:b+1]=B[r,a:b+1]*0.55+np.array([60,40,30],np.float32)*0.45
# extend back outward the same way as the front
_,(iy,ix)=nd.distance_transform_edt(~Mi,return_indices=True)
Bx=B[iy,ix];Bb=cv2.GaussianBlur(Bx,(0,0),3);Bx[out]=Bb[out];B=Bx
atlas=np.concatenate([Fc,B],1)
atlas=np.flipud(np.clip(atlas,0,255)).astype(np.uint8)
cv2.imwrite(os.path.join(MODELS,'inspector-resto.jpg'),atlas,[cv2.IMWRITE_JPEG_QUALITY,90])
print('wrote inspector-resto.jpg')

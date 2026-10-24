# run.py ids|all : clean each id with boxes.json, write out/<id>.png (unlisted ids copied unchanged? no: only listed)
import json,sys,os,cv2
D=os.path.dirname(os.path.abspath(__file__)).replace(chr(92),'/'); sys.path.insert(0,D)
from clean import process
B=json.load(open(D+'/boxes.json')); os.makedirs(D+'/out',exist_ok=True)
ids=list(B) if sys.argv[1]=='all' else sys.argv[1].split(',')
for i in ids: cv2.imwrite(f'{D}/out/{i}.png',process(i,B[i]))
print(len(ids),'cleaned')

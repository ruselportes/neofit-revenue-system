import fitz, json, re, sys
sys.path.insert(0,'.')
import content as C
d=fitz.open('spmp.pdf'); texts=[pg.get_text() for pg in d]
front=next(i for i,t in enumerate(texts) if i>=2 and re.search(r'1\.\s*Overview',t))
labels=[v[0] for v in C.FIGURES.values()]+[f'Table {n}.0' for n in range(1,11)]
found={}
for lab in labels:
    for i in range(front,len(texts)):
        if re.search(re.escape(lab)+r'\s',texts[i]): found[lab]=str(i-front+1); break
old=json.load(open('pages.json')) if len(sys.argv)>1 else None
json.dump(found,open('pages.json','w'))
print('pages',d.page_count,found, 'MATCH' if old==found else 'CHANGED')

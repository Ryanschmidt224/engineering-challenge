"""Verify a BuildingSchmidt whole-site data backup; optionally extract recovery files.
No network, credentials, database writes or live-site restore operations.
"""
import argparse,base64,hashlib,json,pathlib,shutil,tempfile
p=argparse.ArgumentParser();p.add_argument('backup');p.add_argument('--extract',type=pathlib.Path);args=p.parse_args()
if args.extract and args.extract.exists():p.error('Extraction destination must not exist.')
def literal(v):
 if v is None:return 'NULL'
 if isinstance(v,dict) and set(v)=={'blob'}:return "X'"+bytes(v['blob']).hex()+"'"
 if isinstance(v,(int,float)):return str(v)
 return "'"+str(v).replace("'","''")+"'"
def quote(v):return '"'+v.replace('"','""')+'"'
with tempfile.TemporaryDirectory() as temp:
 root=pathlib.Path(temp);(root/'objects').mkdir();rows=0;objects=[];schema=[];current=None;digest='';complete=False
 with open(root/'rows.sql','w',encoding='utf8') as sql,open(args.backup,'rb') as source:
  for raw in source:
   if complete:raise ValueError('Content after completion marker')
   if not raw.endswith(b'\n'):raise ValueError('Truncated backup line')
   line=raw[:-1];entry=json.loads(line);kind=entry['type']
   if kind=='complete':
    if entry['sha256']!=digest or current is not None:raise ValueError('Incomplete or corrupted backup')
    complete=True;continue
   digest=hashlib.sha256(digest.encode()+line).hexdigest()
   if kind=='schema':schema=entry['objects']
   elif kind=='row':
    values=entry['value'];sql.write('INSERT INTO '+quote(entry['table'])+'('+','.join(map(quote,values))+') VALUES('+','.join(literal(v) for v in values.values())+');\n');rows+=1
   elif kind=='object':
    if current:raise ValueError('Unfinished object')
    current={**entry,'localFile':'objects/'+str(len(objects)+1)+'.bin'};current.pop('type');current['readSize']=0;current['handle']=open(root/current['localFile'],'wb')
   elif kind=='bytes':
    if current is None:raise ValueError('Object bytes without metadata')
    data=base64.b64decode(entry['data'],validate=True);current['handle'].write(data);current['readSize']+=len(data)
   elif kind=='end_object':
    if current is None or entry['key']!=current['key'] or current['readSize']!=current['size'] or entry['size']!=current['size']:raise ValueError('Object size mismatch')
    current.pop('handle').close();current.pop('readSize');objects.append(current);current=None
 if not complete:raise ValueError('Backup has no verified completion marker')
 if args.extract:
  with open(root/'database.sql','w',encoding='utf8') as out:
   out.write('PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n')
   for item in schema:
    if item['type']=='table':out.write(item['sql']+';\n')
   with open(root/'rows.sql',encoding='utf8') as sql:shutil.copyfileobj(sql,out)
   for item in schema:
    if item['type']!='table':out.write(item['sql']+';\n')
   out.write('COMMIT;\nPRAGMA foreign_keys=ON;\n')
  (root/'rows.sql').unlink();(root/'objects.json').write_text(json.dumps(objects,indent=2),encoding='utf8');shutil.copytree(root,args.extract)
 print('Verified:',rows,'database rows and',len(objects),'stored objects. SHA-256:',digest)

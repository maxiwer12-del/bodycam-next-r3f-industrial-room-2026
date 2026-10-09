import urllib.request,json,concurrent.futures,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
NAMES=['modular_urban_apartments_facade','modular_airduct_rectangular_01','modular_chainlink_fence','rollershutter_door','modular_electric_cables','industrial_caged_sconce','industrial_pastic_container','painted_wooden_cabinet_02','barrel_03','plastic_crate_01','utility_box_01','metal_office_desk','concrete_road_barrier_02']
def grab(name):
 try:
  req=urllib.request.Request('https://api.polyhaven.com/files/'+name,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=30) as f:data=json.load(f)
  tier='2k' if '2k' in data['gltf'] else list(data['gltf'])[-1]
  if name=='modular_urban_apartments_facade':tier='1k'
  entry=data['gltf'][tier]['gltf']
  target=ROOT/'assets-source'/name;target.mkdir(parents=True,exist_ok=True)
  items=[(pathlib.Path(entry['url']).name,entry)]+list(entry.get('include',{}).items())
  for local,record in items:
   dest=target/local;dest.parent.mkdir(parents=True,exist_ok=True)
   if not dest.exists() or dest.stat().st_size!=record['size']:
    urllib.request.urlretrieve(record['url'],dest)
   if dest.stat().st_size!=record['size']:raise Exception('size mismatch '+name)
  (target/'meta.json').write_text(json.dumps({'name':name,'tier':tier,'gltf':pathlib.Path(entry['url']).name,'totalBytes':sum(r['size'] for _,r in items)},indent=2))
  print('READY',name,'MB',round(sum(r['size'] for _,r in items)/1e6,2),flush=True)
 except Exception as e:print('ERROR',name,str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(grab,NAMES))


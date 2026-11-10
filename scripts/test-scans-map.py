import asyncio,json,os,sys,threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from playwright.async_api import async_playwright
html_path=Path(sys.argv[1]).resolve()
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(html_path.parent)))
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(proxy=({'server':os.environ['HTTPS_PROXY'],'bypass':'127.0.0.1,localhost'} if os.environ.get('HTTPS_PROXY') else None),headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  print('Browser launched',flush=True)
  page=await browser.new_page(ignore_https_errors=os.environ.get('MAP_TEST_IGNORE_HTTPS_ERRORS')=='1',device_scale_factor=int(os.environ.get('MAP_TEST_DPR','3')),viewport={'width':430,'height':900})
  errors=[]
  page.on('pageerror',lambda e: (errors.append(str(e)),print('PAGEERROR',e,flush=True)))
  page.on('console',lambda m: print('CONSOLE',m.type,m.text,flush=True) if m.type=='error' else None)
  page.on('requestfailed',lambda r: print('FAILED',r.url,r.failure,flush=True))
  await page.route('**/'+html_path.name,lambda route: route.fulfill(body=html_path.read_text().replace('const map = new maplibregl.Map', 'const map = window.__testMap = new maplibregl.Map'),content_type='text/html'))
  print('Navigating',flush=True)
  await page.goto(f'http://127.0.0.1:{server.server_port}/{html_path.name}')
  print('Document loaded',flush=True)
  await page.wait_for_function('window.avx && window.maplibregl',timeout=60000)
  await page.evaluate("window.mapErrors=[];__testMap.on('error',e=>mapErrors.push(String(e.error)))")
  print("Runtime ready",flush=True)
  try:
   await page.wait_for_function("window.__testMap && __testMap.getSource('detail')",timeout=20000)
  except Exception:
   print(await page.evaluate("({errors:mapErrors,loaded:__testMap.loaded(),style:__testMap.isStyleLoaded(),sources:Object.keys(__testMap.getStyle()?.sources||{})})"),flush=True)
   raise
  await page.evaluate("window.mapErrors=[];__testMap.on('error',e=>mapErrors.push(String(e.error)));__testMap.jumpTo({center:[-99.1332,19.4326],zoom:18})")
  await page.wait_for_function("__testMap.isSourceLoaded('openmaptiles') && __testMap.areTilesLoaded()",timeout=60000)
  await page.wait_for_function("__testMap.queryRenderedFeatures().some(f=>f.source==='openmaptiles')",timeout=60000)
  if os.environ.get('MAP_TEST_SCREENSHOT'):
   await page.screenshot(path=os.environ['MAP_TEST_SCREENSHOT']+'-base.png')
  result=await page.evaluate('''async()=>{
   const p=(lat,lng)=>({lat,lng});const route=[p(19.40,-102.1),p(19.401,-102.101),p(19.402,-102.102)];
   const orchard=[...route,p(19.402,-102.1)];
   const data={orchards:[{id:'o',points:orchard}],routes:[{id:'r',points:route}],scans:[{id:'r',...route[0],status:'listo'}],zones:[],show:{orchards:true,routes:true,photos:true,findings:true},fitKey:'one',reduced:true};
   avx.setData(data);avx.select('r');avx.setDetail({id:'r',route,orchard,photos:[{id:'p',...route[1]}],findings:[{id:'f',cat:'enfermo',...route[2]}]},true);
   await new Promise(r=>setTimeout(r,500));
   for(const layer of ['satelite','hibrido','estandar','zonas','oscuro'])avx.setLayer(layer);
   for(const style of ['tiempo','velocidad','calor','clasica'])avx.setRouteStyle(style);
   avx.point('finding','f');avx.showUser(19.401,-102.1,false);avx.setPad({top:100,bottom:250,left:20,right:70});avx.fit();
   await new Promise(r=>setTimeout(r,800));
   if(__testMap.getSource('detail')._data.features.length!==1)throw Error('Route missing');
   if(__testMap.getSource('findings')._data.features.length!==1)throw Error('Finding missing');
   if(__testMap.getSource('endpoints')._data.features.length!==2)throw Error('Endpoints missing');
   if(__testMap.getLayoutProperty('dark-background','visibility')!=='visible')throw Error('Dark base missing');
   if(__testMap.getStyle().sources.openmaptiles.type!=='vector')throw Error('Base must be vector');
   const visibleRaster=__testMap.getStyle().layers.filter(l=>l.type==='raster'&&l.layout?.visibility!=='none');
   if(visibleRaster.length)throw Error('Raster visible in dark mode');
   if(__testMap.getImage('camera').pixelRatio!==3)throw Error('Low resolution icon');
   if(__testMap.getImage('end').pixelRatio!==3)throw Error('Low resolution endpoint');
   const overlay=__testMap.getSource('detail');
   for(const mode of ['estandar','hibrido','satelite','zonas','oscuro']) {
     avx.setLayer(mode);
     if(__testMap.getSource('detail')!==overlay)throw Error('Overlay reconstructed');
   }
   avx.setPerspective(false);
   await new Promise(r=>setTimeout(r,50));
   if(__testMap.getPitch()!==0)throw Error('2D toggle failed');
   avx.setPerspective(true);avx.fit();
   await new Promise(r=>setTimeout(r,100));
   if(Math.abs(__testMap.getPitch()-48)>.1)throw Error('Perspective lost on fit');
   if(__testMap.getLayoutProperty('avx-buildings','visibility')!=='visible')throw Error('3D buildings missing');
   const location=__testMap.project([-102.101,19.401]);
   const photoHits=__testMap.queryRenderedFeatures([location.x+32,location.y],{layers:['photos-circle']});
   if(!photoHits.length)throw Error('Photo callout hit target missing');
   const end=__testMap.project([-102.102,19.402]);
   if(!__testMap.queryRenderedFeatures([end.x,end.y+48],{layers:['endpoints-icon']}).length)throw Error('End callout missing');
   if(!__testMap.queryRenderedFeatures([end.x,end.y],{layers:['findings-circle']}).length)throw Error('Finding at endpoint hidden');
   if(mapErrors.length)throw Error(mapErrors.join(';'));
   return {canvas:!!document.querySelector('canvas.maplibregl-canvas'),attribution:!!document.querySelector('.maplibregl-ctrl-attrib')};
  }''')
  
  if os.environ.get('MAP_TEST_SCREENSHOT'):
   await page.screenshot(path=os.environ['MAP_TEST_SCREENSHOT']+'-markers.png')
  print(json.dumps({'result':result,'errors':errors}))
  assert not errors
  await browser.close()
asyncio.run(main())

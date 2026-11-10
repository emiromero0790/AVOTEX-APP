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
  page=await browser.new_page(ignore_https_errors=os.environ.get('MAP_TEST_IGNORE_HTTPS_ERRORS')=='1',viewport={'width':430,'height':900})
  errors=[]
  page.on('pageerror',lambda e: (errors.append(str(e)),print('PAGEERROR',e,flush=True)))
  page.on('requestfailed',lambda r: print('FAILED',r.url,r.failure,flush=True))
  await page.route('**/'+html_path.name,lambda route: route.fulfill(body=html_path.read_text().replace('const map = new maplibregl.Map', 'const map = window.__testMap = new maplibregl.Map'),content_type='text/html'))
  await page.goto(f'http://127.0.0.1:{server.server_port}/{html_path.name}')
  await page.wait_for_function('window.avx && window.maplibregl',timeout=60000)
  await page.wait_for_timeout(4000)
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
   if(__testMap.getLayoutProperty('dark','visibility')!=='visible')throw Error('Dark base missing');
   return {canvas:!!document.querySelector('canvas.maplibregl-canvas'),attribution:!!document.querySelector('.maplibregl-ctrl-attrib')};
  }''')
  
  print(json.dumps({'result':result,'errors':errors}))
  assert not errors
  await browser.close()
asyncio.run(main())

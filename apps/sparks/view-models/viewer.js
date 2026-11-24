import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js'

export async function mount(holder,url,title){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const model=(await loader.loadAsync(url)).scene
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,2))
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.02,40)
  const material=new THREE.MeshStandardMaterial({color:0xfff6e8,roughness:.8,side:THREE.DoubleSide})
  model.traverse(o=>{if(o.isMesh){o.material.dispose();o.material=material;if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals()}})
  scene.add(model,new THREE.HemisphereLight(0xfffaf1,0xbaafa1,1.7))
  const light=new THREE.DirectionalLight(0xfff5da,2.4);light.position.set(-3,5,4);scene.add(light)
  camera.position.set(.15,-.35,3.5)
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Rotate '+title)
  const controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.minDistance=1.5;controls.maxDistance=6
  const draw=()=>renderer.render(scene,camera)
  controls.addEventListener('change',draw)
  canvas.onkeydown=e=>{
    const delta={ArrowLeft:[0,-.15],ArrowRight:[0,.15],ArrowUp:[-.15,0],ArrowDown:[.15,0]}[e.key]
    if(!delta)return
    e.preventDefault();const orbit=new THREE.Spherical().setFromVector3(camera.position);orbit.phi+=delta[0];orbit.theta+=delta[1];orbit.makeSafe();camera.position.setFromSpherical(orbit);controls.update()
  }
  const resize=()=>{const w=holder.clientWidth,h=holder.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();draw()}
  holder.replaceChildren(canvas);controls.update();const observer=new ResizeObserver(resize);observer.observe(holder);resize()
  return ()=>{observer.disconnect();controls.dispose();model.traverse(o=>o.geometry?.dispose());material.dispose();renderer.dispose();renderer.forceContextLoss()}
}

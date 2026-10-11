'use client';

import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';

type Quality='High'|'Cinematic Max';

// An actual camera-centered atmosphere instead of displaying the lighting HDR
// panorama as the background. A single analytic cloud shader avoids volumetric
// raymarching, giant transparent quads, cloud image downloads and parallax seams.
const skyVertex=/* glsl */`
varying vec3 vSkyDirection;
void main() {
  vSkyDirection=normalize(position);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;

const skyFragment=/* glsl */`
precision highp float;
uniform float uTime;
uniform float uDetail;
varying vec3 vSkyDirection;

float hash3(vec3 p) {
  p=fract(p*0.1031);
  p+=dot(p,p.yxz+33.33);
  return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p) {
  vec3 i=floor(p);
  vec3 f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash3(i),hash3(i+vec3(1.0,0.0,0.0)),f.x),
        mix(hash3(i+vec3(0.0,1.0,0.0)),hash3(i+vec3(1.0,1.0,0.0)),f.x),f.y),
    mix(mix(hash3(i+vec3(0.0,0.0,1.0)),hash3(i+vec3(1.0,0.0,1.0)),f.x),
        mix(hash3(i+vec3(0.0,1.0,1.0)),hash3(i+vec3(1.0,1.0,1.0)),f.x),f.y),
    f.z);
}
float cloudNoise(vec3 p) {
  return 0.53*noise3(p)
       + 0.29*noise3(p*2.03+vec3(7.1,2.3,1.4))
       + 0.18*noise3(p*4.07+vec3(3.3,9.2,5.7));
}
void main() {
  vec3 dir=normalize(vSkyDirection);
  float altitude=clamp(dir.y,0.0,1.0);
  float gradient=smoothstep(0.0,0.82,altitude);
  // Colors are linear. Three's output color-space conversion happens below.
  vec3 horizon=vec3(0.59,0.71,0.80);
  vec3 zenith=vec3(0.18,0.36,0.62);
  vec3 sky=mix(horizon,zenith,pow(gradient,0.72));

  vec3 sunDir=normalize(vec3(0.42,0.85,-0.30));
  float sunFacing=max(dot(dir,sunDir),0.0);
  float diffuseHalo=pow(sunFacing,24.0);
  sky+=vec3(0.11,0.085,0.050)*diffuseHalo;

  // Spherical 3D noise is continuous across the 360-degree seam.
  // Motion is intentionally subtle to avoid shimmer on mobile devices.
  vec3 wind=vec3(0.0032*uTime,0.0,0.0016*uTime);
  vec3 point=dir*6.4+wind;
  float masses=cloudNoise(point);
  float wisps=noise3(point*3.0+vec3(2.7,1.5,4.1));
  float shape=masses+(wisps-0.5)*mix(0.075,0.115,uDetail);
  float opacity=smoothstep(0.51,0.665,shape);
  // The cloud layer thins at the horizon, blending into a hazy daylight sky.
  opacity*=smoothstep(-0.045,0.18,dir.y);

  float light=0.38+0.48*noise3(dir*8.3+wind*0.2+vec3(5.2));
  light+=0.17*sunFacing;
  vec3 shadedCloud=mix(vec3(0.67,0.72,0.76),vec3(0.96,0.97,0.96),clamp(light,0.0,1.0));
  sky=mix(sky,shadedCloud,opacity*0.93);

  gl_FragColor=vec4(sky,1.0);
  #include <colorspace_fragment>
}
`;

/**
 * One draw call, ~1k sky triangles, zero downloaded cloud textures.
 * The sky tracks camera translation without turning with the camera so the
 * city remains visually stationary below the clouds.
 */
export function BistroCloudSky({quality}:{quality:Quality}) {
  const {camera}=useThree();
  const mesh=useRef<THREE.Mesh>(null);
  const geometry=useMemo(()=>new THREE.SphereGeometry(180,40,24),[]);
  const material=useMemo(()=>new THREE.ShaderMaterial({
    name:'BistroCloudAtmosphere',
    vertexShader:skyVertex,
    fragmentShader:skyFragment,
    uniforms:{uTime:{value:0},uDetail:{value:0}},
    side:THREE.BackSide,
    transparent:false,
    depthTest:true,
    depthWrite:false,
    fog:false,
    toneMapped:false,
  }),[]);

  useEffect(()=>{
    material.uniforms.uDetail.value=quality==='Cinematic Max'?1:0;
  },[quality,material]);

  useFrame((_,dt)=>{
    if(mesh.current)mesh.current.position.copy(camera.position);
    material.uniforms.uTime.value+=Math.min(dt,0.06);
  });

  useEffect(()=>()=>{geometry.dispose();material.dispose()},[geometry,material]);

  return <mesh
    ref={mesh}
    name="BistroCloudSky"
    geometry={geometry}
    material={material}
    frustumCulled={false}
    renderOrder={-1000}
    castShadow={false}
    receiveShadow={false}
    userData={{isAtmosphere:true}}
  />;
}

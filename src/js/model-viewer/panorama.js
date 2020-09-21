import * as THREE from 'three';
import { RgbeLoader } from './rgbe.loader';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
	vUv = uv;
	// gl_PointSize = 8.0;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
varying vec2 vUv;
uniform vec2 resolution;
uniform sampler2D texture;

vec3 ACESFilmicToneMapping_( vec3 color ) {
	color *= 1.8;
	return saturate( ( color * ( 2.51 * color + 0.03 ) ) / ( color * ( 2.43 * color + 0.59 ) + 0.14 ) );
}

vec4 getColor(vec2 p) {
	return texture2D(texture, p);
}

vec3 encodeColor(vec4 color) {
	return ACESFilmicToneMapping_(RGBEToLinear(color).rgb);
}

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 Blur(vec2 st, vec4 color) {
	const float directions = 16.0;
	const float quality = 3.0;
	float size = 16.0;
	const float PI2 = 6.28318530718;
	const float qq = 1.0;
	const float q = 1.0 / quality;
	vec2 radius = size / resolution.xy;
	for (float d = 0.0; d < PI2; d += PI2 / directions) {
		for (float i = q; i <= qq; i += q) {
			vec2 dUv = vec2(cos(d), sin(d)) * radius * i;
			color += getColor(st + dUv);
        }
	}
	return color /= quality * directions - 15.0 + rand(st) * 4.0;
}

void main() {
	vec4 color = getColor(vUv);
	// color = Blur(vUv, color);
	color = vec4(encodeColor(color) + rand(vUv) * 0.1, 1.0);
	gl_FragColor = color;
}
`;

export class Panorama {

	constructor() {
		this.create();
	}

	create() {
		const geometry = new THREE.SphereBufferGeometry(101, 60, 40);
		geometry.scale(-1, 1, 1);
		// const material = new THREE.MeshBasicMaterial();
		const material = new THREE.ShaderMaterial({
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			uniforms: {
				texture: { type: "t", value: null },
				resolution: { value: new THREE.Vector2() }
			},
		});
		const mesh = this.mesh = new THREE.Mesh(geometry, material);
	}

	loadRgbe(item, renderer, callback) {
		RgbeLoader.load(item, renderer, (envMap, texture) => {
			texture.magFilter = THREE.LinearFilter;
			texture.needsUpdate = true;
			this.mesh.material.map = texture;
			this.mesh.material.uniforms.texture.value = texture;
			this.mesh.material.uniforms.resolution.value = new THREE.Vector2(texture.width, texture.height);
			// console.log(texture.width, texture.height);
			this.mesh.material.needsUpdate = true;
			if (typeof callback === 'function') {
				callback(envMap);
			}
			// console.log(this.mesh.material);
		});
	}

}

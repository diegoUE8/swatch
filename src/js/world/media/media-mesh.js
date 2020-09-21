import { of } from 'rxjs';
import { map } from 'rxjs/operators';
import * as THREE from 'three';
import AgoraService, { RoleType } from '../../agora/agora.service';
import { environment } from '../../environment';
import InteractiveMesh from '../interactive/interactive.mesh';
import MediaLoader, { MediaLoaderPauseEvent, MediaLoaderPlayEvent } from './media-loader';

const VERTEX_SHADER = `
#extension GL_EXT_frag_depth : enable

varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
#extension GL_EXT_frag_depth : enable

varying vec2 vUv;
uniform bool video;
uniform float opacity;
uniform float overlay;
uniform float tween;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolutionA;
uniform vec2 resolutionB;
uniform vec3 overlayColor;

mat3 rotate(float a) {
	return mat3(
		cos(a), sin(a), 0.0,
		-sin(a), cos(a), 0.0,
		0.0, 0.0, 1.0
	);
}

mat3 translate(vec2 t) {
	return mat3(
		1.0, 0.0, 0.0,
		0.0, 1.0, 0.0,
		t.x, t.y, 1.0
	);
}

mat3 scale(vec2 s) {
	return mat3(
		s.x, 0.0, 0.0,
		0.0, s.y, 0.0,
		0.0, 0.0, 1.0
	);
}

vec2 getUV2(vec2 vUv, vec2 t, vec2 s, float a) {
	mat3 transform = scale(s) * rotate(a);
	return (vec3(vUv + t, 0.0) * transform).xy;
}

void main() {
	vec4 color;
	vec4 colorA = texture2D(textureA, vUv);
	if (video) {
		float rA = resolutionA.x / resolutionA.y;
		float rB = resolutionB.x / resolutionB.y;
		float aspect = 1.0 / rA * rB;
		vec2 s = vec2(3.0 / aspect, 3.0);
		vec2 t = vec2(
			-(resolutionA.x - resolutionB.x / s.x) * 0.5 / resolutionA.x,
			-(resolutionA.y - resolutionB.y / s.y) * 0.5 / resolutionA.y
		);
		t = vec2(
			-(resolutionA.x - resolutionB.x / s.y) * 0.5 / resolutionA.x,
			-(resolutionA.y - resolutionB.y / s.y) * 0.5 / resolutionA.y
		);
		vec2 uv2 = clamp(
			getUV2(vUv, t, s, 0.0),
			vec2(0.0,0.0),
			vec2(1.0,1.0)
		);
		vec4 colorB = texture2D(textureB, uv2);
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2) + (colorB.rgb * tween * colorB.a), opacity);
	} else {
		color = vec4(colorA.rgb + (overlayColor * overlay * 0.2), opacity);
	}
	gl_FragColor = color;
}
`;

const FRAGMENT_CHROMA_KEY_SHADER = `
#extension GL_EXT_frag_depth : enable

#define threshold 0.55
#define padding 0.05

varying vec2 vUv;
uniform bool video;
uniform float opacity;
uniform float overlay;
uniform float tween;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec2 resolutionA;
uniform vec2 resolutionB;
uniform vec3 chromaKeyColor;
uniform vec3 overlayColor;

void main() {
	vec4 color;
	vec4 colorA = texture2D(textureA, vUv);
	vec4 chromaKey = vec4(chromaKeyColor, 1.0);
    vec3 chromaKeyDiff = colorA.rgb - chromaKey.rgb;
    float chromaKeyValue = smoothstep(threshold - padding, threshold + padding, dot(chromaKeyDiff, chromaKeyDiff));
	color = vec4(colorA.rgb + (overlayColor * overlay * 0.2), opacity * chromaKeyValue);
	gl_FragColor = color;
}
`;

export default class MediaMesh extends InteractiveMesh {

	static getMaterial(useChromaKey) {
		const material = new THREE.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			vertexShader: VERTEX_SHADER,
			fragmentShader: useChromaKey ? FRAGMENT_CHROMA_KEY_SHADER : FRAGMENT_SHADER,
			uniforms: {
				video: { value: false },
				textureA: { type: "t", value: null },
				textureB: { type: "t", value: null },
				resolutionA: { value: new THREE.Vector2() },
				resolutionB: { value: new THREE.Vector2() },
				overlayColor: { value: new THREE.Color('#ffffff') },
				overlay: { value: 0 },
				tween: { value: 1 },
				opacity: { value: 0 },
			},
			// side: THREE.DoubleSide
		});
		return material;
	}

	static getChromaKeyMaterial(chromaKeyColor = [0.0, 1.0, 0.0]) {
		const material = new THREE.ShaderMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_CHROMA_KEY_SHADER,
			uniforms: {
				video: { value: false },
				textureA: { type: "t", value: null },
				textureB: { type: "t", value: null },
				resolutionA: { value: new THREE.Vector2() },
				resolutionB: { value: new THREE.Vector2() },
				chromaKeyColor: { value: new THREE.Vector3(chromaKeyColor[0], chromaKeyColor[1], chromaKeyColor[2]) },
				overlayColor: { value: new THREE.Color('#ffffff') },
				overlay: { value: 0 },
				tween: { value: 1 },
				opacity: { value: 0 },
			},
			side: THREE.DoubleSide
		});
		return material;
	}

	static getStreamId$(item) {
		const file = item.asset.file;
		if (file !== 'publisherStream' && file !== 'nextAttendeeStream') {
			return of(file);
		}
		const agora = AgoraService.getSingleton();
		if (agora) {
			return agora.streams$.pipe(
				map((streams) => {
					let stream;
					if (file === 'publisherStream') {
						stream = streams.find(x => x.clientInfo && x.clientInfo.role === RoleType.Publisher);
					} else if (file === 'nextAttendeeStream') {
						let i = 0;
						streams.forEach(x => {
							if (x.clientInfo && x.clientInfo.role === RoleType.Attendee) {
								if (i === item.asset.index) {
									stream = x;
								}
								i++;
							}
						});
					}
					if (stream) {
						return stream.getId();
					} else {
						return null;
					}
				}),
			);
		} else {
			return of(null);
		}
	}

	constructor(item, items, geometry, material) {
		material = material || MediaMesh.getMaterial();
		super(geometry, material);
		this.item = item;
		this.items = items;
		this.renderOrder = environment.renderOrder.plane;
		const uniforms = this.uniforms = {
			overlay: 0,
			tween: 1,
			opacity: 0,
		};
		const mediaLoader = this.mediaLoader = new MediaLoader(item);
		if (!mediaLoader.isVideo) {
			this.freeze();
		}
	}

	load(callback) {
		const material = this.material;
		const mediaLoader = this.mediaLoader;
		if (mediaLoader.isPlayableVideo) {
			const textureB = MediaLoader.loadTexture({
				asset: {
					folder: 'ui/', file: 'play.png'
				}
			}, (textureB) => {
				// console.log('MediaMesh.textureB', textureB);
				textureB.minFilter = THREE.LinearFilter;
				textureB.magFilter = THREE.LinearFilter;
				textureB.mapping = THREE.UVMapping;
				// textureB.format = THREE.RGBFormat;
				textureB.wrapS = THREE.RepeatWrapping;
				textureB.wrapT = THREE.RepeatWrapping;
				material.uniforms.textureB.value = textureB;
				material.uniforms.resolutionB.value = new THREE.Vector2(textureB.image.width, textureB.image.height);
				// console.log(material.uniforms.resolutionB.value, textureB);
				material.needsUpdate = true;
			});
		}
		mediaLoader.load((textureA) => {
			// console.log('MediaMesh.textureA', textureA);
			material.uniforms.textureA.value = textureA;
			material.uniforms.resolutionA.value = new THREE.Vector2(textureA.image.width || textureA.image.videoWidth, textureA.image.height || textureA.image.videoHeight);
			material.needsUpdate = true;
			this.onAppear();
			if (mediaLoader.isPlayableVideo) {
				material.uniforms.video.value = true;
				this.onOver = this.onOver.bind(this);
				this.onOut = this.onOut.bind(this);
				this.onToggle = this.onToggle.bind(this);
				this.on('over', this.onOver);
				this.on('out', this.onOut);
				this.on('down', this.onToggle);
			}
			if (typeof callback === 'function') {
				callback(this);
			}
		});
	}

	events$() {
		const item = this.item;
		const items = this.items;
		if (item.asset && item.asset.linkedPlayId) {
			this.freeze();
		}
		return MediaLoader.events$.pipe(
			map(event => {
				if (item.asset && item.asset.linkedPlayId) {
					const eventItem = items.find(x => x.asset && event.src.indexOf(x.asset.file) !== -1 && event.id === item.asset.linkedPlayId);
					if (eventItem) {
						// console.log('MediaLoader.events$.eventItem', event, eventItem);
						if (event instanceof MediaLoaderPlayEvent) {
							this.play();
						} else if (event instanceof MediaLoaderPauseEvent) {
							this.pause();
						}
					}
				}
				return event;
			})
		);
	}

	onAppear() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, 0.4, {
				opacity: 1,
				ease: Power2.easeInOut,
				onUpdate: () => {
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onDisappear() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, 0.4, {
				opacity: 0,
				ease: Power2.easeInOut,
				onUpdate: () => {
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onOver() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, 0.4, {
				overlay: 1,
				tween: 0,
				opacity: 1,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					material.uniforms.overlay.value = uniforms.overlay;
					material.uniforms.tween.value = uniforms.tween;
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onOut() {
		const uniforms = this.uniforms;
		const material = this.material;
		if (material.uniforms) {
			gsap.to(uniforms, 0.4, {
				overlay: 0,
				tween: this.playing ? 0 : 1,
				opacity: 1,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					material.uniforms.overlay.value = uniforms.overlay;
					material.uniforms.tween.value = uniforms.tween;
					material.uniforms.opacity.value = uniforms.opacity;
					material.needsUpdate = true;
				},
			});
		}
	}

	onToggle() {
		this.playing = this.mediaLoader.toggle();
		this.onOut();
	}

	play() {
		this.mediaLoader.play();
		this.playing = true;
		this.onOut();
	}

	pause() {
		this.mediaLoader.pause();
		this.playing = false;
		this.onOut();
	}

	dispose() {
		const mediaLoader = this.mediaLoader;
		if (mediaLoader.isPlayableVideo) {
			this.off('over', this.onOver);
			this.off('out', this.onOut);
			this.off('down', this.onToggle);
		}
		mediaLoader.dispose();
	}

}

import { ReplaySubject } from 'rxjs';
import { auditTime, takeUntil, tap } from 'rxjs/operators';
import * as THREE from 'three';
// import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
// import { RoughnessMipmapper } from 'three/examples/jsm/utils/RoughnessMipmapper.js';
import { environment } from '../../environment';
import Interactive from '../interactive/interactive';
import InteractiveMesh from '../interactive/interactive.mesh';
import WorldComponent from '../world.component';
import ModelComponent from './model.component';

const NAV_RADIUS = 100;
const ORIGIN = new THREE.Vector3();

export default class ModelNavComponent extends ModelComponent {

	static getLoader() {
		return ModelNavComponent.loader || (ModelNavComponent.loader = new THREE.TextureLoader());
	}

	static getTexture() {
		return ModelNavComponent.texture || (ModelNavComponent.texture = ModelNavComponent.getLoader().load(environment.getTexturePath('ui/wall-nav.png')));
	}

	onInit() {
		super.onInit();
		this.debouncedOver$ = new ReplaySubject(1).pipe(
			auditTime(250),
			tap(event => this.over.next(event)),
			takeUntil(this.unsubscribe$),
		);
		this.debouncedOver$.subscribe();
		// console.log('ModelNavComponent.onInit');
	}

	onDestroy() {
		Interactive.dispose(this.sphere);
		super.onDestroy();
	}

	onCreate(mount, dismount) {
		// this.renderOrder = environment.renderOrder.nav;
		const nav = new THREE.Group();
		this.item.nav = nav;

		const position = new THREE.Vector3().set(...this.item.position).normalize().multiplyScalar(NAV_RADIUS);
		nav.position.set(position.x, position.y, position.z);

		const map = ModelNavComponent.getTexture();
		map.disposable = false;
		map.encoding = THREE.sRGBEncoding;
		const material = new THREE.SpriteMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			map: map,
			sizeAttenuation: false,
			opacity: 0,
			// color: 0xff0000,
		});
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(0.03, 0.03, 0.03);
		nav.add(sprite);

		// const geometry = new THREE.PlaneBufferGeometry(3, 2, 2, 2);
		const geometry = new THREE.SphereBufferGeometry(3, 12, 12);
		const sphere = new InteractiveMesh(geometry, new THREE.MeshBasicMaterial({
			depthTest: false,
			depthWrite: false,
			transparent: true,
			opacity: 0.0,
			color: 0x00ffff,
		}));
		sphere.lookAt(ORIGIN);
		sphere.depthTest = false;
		sphere.renderOrder = 0;
		nav.add(sphere);
		sphere.on('over', () => {
			const from = { scale: sprite.scale.x };
			gsap.to(from, 0.4, {
				scale: 0.04,
				delay: 0,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					sprite.scale.set(from.scale, from.scale, from.scale);
				}
			});
			this.debouncedOver$.next(this.item);
		});
		sphere.on('out', () => {
			const from = { scale: sprite.scale.x };
			gsap.to(from, 0.4, {
				scale: 0.03,
				delay: 0,
				ease: Power2.easeInOut,
				overwrite: true,
				onUpdate: () => {
					sprite.scale.set(from.scale, from.scale, from.scale);
				}
			});
			this.out.next(this.item);
		});
		sphere.on('down', () => {
			this.down.next(this.item);
		});
		const from = { opacity: 0 };
		gsap.to(from, 0.7, {
			opacity: 1,
			delay: 0.5 + 0.1 * this.item.index,
			ease: Power2.easeInOut,
			overwrite: true,
			onUpdate: () => {
				// console.log(index, from.opacity);
				material.opacity = from.opacity;
				material.needsUpdate = true;
			}
		});
		if (typeof mount === 'function') {
			mount(nav);
		}
	}
}

ModelNavComponent.meta = {
	selector: '[model-nav]',
	hosts: { host: WorldComponent },
	outputs: ['over', 'out', 'down'],
	inputs: ['item'],
};

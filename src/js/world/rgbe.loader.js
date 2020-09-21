import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { environment } from '../environment';

export class RgbeLoader {

	static load(item, renderer, callback) {
		return this.loadRgbeBackground(environment.getTexturePath(item.asset.folder), item.asset.file, renderer, callback);
	}

	static loadRgbeBackground(path, file, renderer, callback) {
		const pmremGenerator = new THREE.PMREMGenerator(renderer);
		pmremGenerator.compileEquirectangularShader();
		const loader = new RGBELoader();
		loader
			.setDataType(THREE.UnsignedByteType)
			// .setDataType(THREE.FloatType)
			.setPath(path)
			.load(file, (texture) => {
				const envMap = pmremGenerator.fromEquirectangular(texture).texture;
				// texture.dispose();
				pmremGenerator.dispose();
				if (typeof callback === 'function') {
					callback(envMap, texture);
				}
			});
		return loader;
	}

}

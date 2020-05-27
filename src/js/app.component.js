import { Component, getContext } from 'rxcomp';
// import UserService from './user/user.service';
import { FormControl, FormGroup, Validators } from 'rxcomp-form';
import { first, takeUntil } from 'rxjs/operators';
import AgoraService, { MessageType, RoleType } from './agora/agora.service';
import { BASE_HREF, DEBUG } from './const';
import HttpService from './http/http.service';
import LocationService from './location/location.service';
import ModalService, { ModalResolveEvent } from './modal/modal.service';

const CONTROL_REQUEST = BASE_HREF + 'control-request.html';
const TRY_IN_AR = BASE_HREF + 'try-in-ar.html';

export class AppComponent extends Component {

	onInit() {
		const { node } = getContext(this);
		node.classList.remove('hidden');
		this.items = [];
		this.item = null;
		this.form = null;
		if (!DEBUG) {
			const agora = this.agora = AgoraService.getSingleton();
			agora.message$.pipe(
				takeUntil(this.unsubscribe$)
			).subscribe(message => {
				console.log('AppComponent.message', message);
				switch (message.type) {
					case MessageType.RequestControl:
						this.onRemoteControlRequest(message);
						break;
					case MessageType.RequestControlAccepted:
						agora.sendMessage({
							type: MessageType.MenuNavTo,
							id: this.item.id,
						});
						break;
					case MessageType.MenuNavTo:
						if (agora.state.locked && message.id) {
							if (this.controls.product.value !== message.id) {
								this.controls.product.value = message.id;
							}
						}
						break;
				}
			});
			agora.state$.pipe(
				takeUntil(this.unsubscribe$)
			).subscribe(state => {
				console.log('AppComponent.state', state);
				this.state = state;
				this.pushChanges();
			});
		} else {
			this.state = {
				role: LocationService.get('role') || RoleType.Attendee,
				connecting: false,
				connected: true,
				locked: false,
				control: false,
				cameraMuted: false,
				audioMuted: false,
			};
		}
		this.loadData();
		this.checkCamera();
	}

	checkCamera() {
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
				console.log('stream', stream);
				if (!DEBUG) {
					this.agora.patchState({ mediaEnabled: true });
				}
			}).catch((error) => {
				console.log('media error', error);
			});
		}
	}

	onPrevent(event) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}

	loadData() {
		HttpService.get$('./api/data.json').pipe(
			first()
		).subscribe(data => {
			this.data = data;
			this.initForm();
		});
	}

	initForm() {
		const data = this.data;
		const form = this.form = new FormGroup({
			product: new FormControl(data.products[0].id, Validators.RequiredValidator()),
		});
		const controls = this.controls = form.controls;
		controls.product.options = data.products;
		form.changes$.pipe(
			takeUntil(this.unsubscribe$)
		).subscribe((changes) => {
			// console.log('form.changes$', changes, form.valid);
			const product = data.products.find(x => x.id === changes.product);
			this.items = [];
			this.item = null;
			this.pushChanges();
			setTimeout(() => {
				this.items = product ? product.items : [];
				this.item = product;
				this.pushChanges();
				if (!DEBUG && this.agora.state.control) {
					this.agora.sendMessage({
						type: MessageType.MenuNavTo,
						id: product.id,
					});
				}
			}, 1);
		});
	}

	connect() {
		if (!this.state.connecting) {
			this.state.connecting = true;
			this.pushChanges();
			setTimeout(() => {
				this.agora.connect$().pipe(
					takeUntil(this.unsubscribe$)
				).subscribe((state) => {
					this.state = Object.assign(this.state, state);
					this.pushChanges();
				});
			}, 1000);
		}
	}

	disconnect() {
		this.state.connecting = false;
		if (!DEBUG) {
			this.agora.leaveChannel();
		} else {
			this.state.connected = false;
			this.pushChanges();
		}
	}

	onChange(index) {
		if (!DEBUG && this.state.control) {
			this.agora.sendMessage({
				type: MessageType.SlideChange,
				index
			});
		}
	}

	onRotate(coords) {
		if (!DEBUG && this.state.control) {
			this.agora.sendMessage({
				type: MessageType.SlideRotate,
				coords
			});
		}
	}

	onRemoteControlRequest(message) {
		ModalService.open$({ src: CONTROL_REQUEST, data: null }).pipe(
			takeUntil(this.unsubscribe$)
		).subscribe(event => {
			if (event instanceof ModalResolveEvent) {
				message.type = MessageType.RequestControlAccepted;
				this.state.locked = true;
			} else {
				message.type = MessageType.RequestControlRejected;
				this.state.locked = false;
			}
			if (!DEBUG) {
				this.agora.sendMessage(message);
			}
			this.pushChanges();
		});
	}

	onDropped(id) {
		console.log('AppComponent.onDropped', id);
	}

	parseQueryString() {
		const action = LocationService.get('action');
		switch (action) {
			case 'login':
				this.openLogin();
				break;
			case 'register':
				this.openRegister();
				break;
		}
	}

	// onView() { const context = getContext(this); }

	// onChanges() {}

	// onDestroy() {}

	toggleCamera() {
		if (!DEBUG) {
			this.agora.toggleCamera();
		}
	}

	toggleAudio() {
		if (!DEBUG) {
			this.agora.toggleAudio();
		}
	}

	toggleControl() {
		if (!DEBUG) {
			this.agora.toggleControl();
		} else {
			this.onRemoteControlRequest({});
		}
	}

	addToWishlist() {
		if (!this.item.added) {
			this.item.added = true;
			this.item.likes++;
			this.pushChanges();
		}
	}

	tryInAr() {
		ModalService.open$({ src: TRY_IN_AR, data: this.item }).pipe(
			takeUntil(this.unsubscribe$)
		).subscribe(event => {
			// this.pushChanges();
		});
	}

}

AppComponent.meta = {
	selector: '[app-component]',
};

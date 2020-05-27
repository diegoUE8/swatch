import { CoreModule, Module } from 'rxcomp';
import { FormModule } from 'rxcomp-form';
import { AppComponent } from './app.component';
import ControlRequestComponent from './control-request/control-request.component';
import DropdownItemDirective from './dropdown/dropdown-item.directive';
import DropdownDirective from './dropdown/dropdown.directive';
import ControlCustomSelectComponent from './forms/control-custom-select.component';
import ModalOutletComponent from './modal/modal-outlet.component';
import ModalComponent from './modal/modal.component';
import { ModelGltfComponent } from './model-viewer/model-gltf.component';
import { ModelPictureComponent } from './model-viewer/model-picture.component';
import { ModelTextComponent } from './model-viewer/model-text.component';
import { ModelViewerComponent } from './model-viewer/model-viewer.component';
import { ModelComponent } from './model-viewer/model.component';
import { SliderDirective } from './slider/slider.directive';
import TryInARComponent from './try-in-ar/try-in-ar';

export class AppModule extends Module {}

AppModule.meta = {
	imports: [
		CoreModule,
		FormModule,
	],
	declarations: [
		ControlCustomSelectComponent,
		ControlRequestComponent,
		DropdownDirective,
		DropdownItemDirective,
		ModalComponent,
		ModalOutletComponent,
		ModelComponent,
		ModelGltfComponent,
		ModelPictureComponent,
		ModelTextComponent,
		ModelViewerComponent,
		SliderDirective,
		TryInARComponent,
	],
	bootstrap: AppComponent,
};

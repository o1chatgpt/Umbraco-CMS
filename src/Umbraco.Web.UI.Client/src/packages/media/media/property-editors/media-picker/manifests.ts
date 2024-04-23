import { manifest as schemaManifest } from './Umbraco.MediaPicker.js';
import type { ManifestPropertyEditorUi } from '@umbraco-cms/backoffice/extension-registry';

const manifest: ManifestPropertyEditorUi = {
	type: 'propertyEditorUi',
	alias: 'Umb.PropertyEditorUi.MediaPicker',
	name: 'Media Picker Property Editor UI',
	element: () => import('./property-editor-ui-media-picker.element.js'),
	meta: {
		label: 'Media Picker',
		propertyEditorSchemaAlias: 'Umbraco.MediaPicker3',
		icon: 'icon-picture',
		group: 'pickers',
	},
};

export const manifests = [manifest, schemaManifest];

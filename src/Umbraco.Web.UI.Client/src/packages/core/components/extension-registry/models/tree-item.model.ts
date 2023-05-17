import { UmbTreeItemExtensionElement } from '../interfaces';
import type { ManifestElement } from '@umbraco-cms/backoffice/extension-api';

export interface ManifestTreeItem extends ManifestElement<UmbTreeItemExtensionElement> {
	type: 'treeItem';
	conditions: ConditionsTreeItem;
}

export interface ConditionsTreeItem {
	entityTypes: Array<string>;
}

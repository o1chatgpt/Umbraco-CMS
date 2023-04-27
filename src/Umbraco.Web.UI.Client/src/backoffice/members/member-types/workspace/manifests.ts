import type {
	ManifestWorkspace,
	ManifestWorkspaceAction,
	ManifestWorkspaceEditorView,
} from '@umbraco-cms/backoffice/extensions-registry';

const workspace: ManifestWorkspace = {
	type: 'workspace',
	alias: 'Umb.Workspace.MemberType',
	name: 'Member Type Workspace',
	loader: () => import('./member-type-workspace.element'),
	meta: {
		entityType: 'member-type',
	},
};

const workspaceViews: Array<ManifestWorkspaceEditorView> = [];

const workspaceActions: Array<ManifestWorkspaceAction> = [];

export const manifests = [workspace, ...workspaceViews, ...workspaceActions];

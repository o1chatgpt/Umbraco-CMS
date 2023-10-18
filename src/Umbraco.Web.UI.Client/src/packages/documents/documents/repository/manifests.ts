import { UmbDocumentRepository } from '../repository/document.repository.js';
import { UmbDocumentItemStore } from './document-item.store.js';
import { UmbDocumentStore } from './document.store.js';
import { UmbDocumentTreeStore } from './document.tree.store.js';
import type {
	ManifestItemStore,
	ManifestRepository,
	ManifestStore,
	ManifestTreeStore,
} from '@umbraco-cms/backoffice/extension-registry';

export const DOCUMENT_REPOSITORY_ALIAS = 'Umb.Repository.Document';

const repository: ManifestRepository = {
	type: 'repository',
	alias: DOCUMENT_REPOSITORY_ALIAS,
	name: 'Documents Repository',
	api: UmbDocumentRepository,
};

export const DOCUMENT_STORE_ALIAS = 'Umb.Store.Document';
export const DOCUMENT_TREE_STORE_ALIAS = 'Umb.Store.DocumentTree';
export const DOCUMENT_ITEM_STORE_ALIAS = 'Umb.Store.DocumentItem';

const store: ManifestStore = {
	type: 'store',
	alias: DOCUMENT_STORE_ALIAS,
	name: 'Document Store',
	api: UmbDocumentStore,
};

const treeStore: ManifestTreeStore = {
	type: 'treeStore',
	alias: DOCUMENT_TREE_STORE_ALIAS,
	name: 'Document Tree Store',
	api: UmbDocumentTreeStore,
};

const itemStore: ManifestItemStore = {
	type: 'itemStore',
	alias: DOCUMENT_ITEM_STORE_ALIAS,
	name: 'Document Item Store',
	api: UmbDocumentItemStore,
};

export const manifests = [repository, store, treeStore, itemStore];

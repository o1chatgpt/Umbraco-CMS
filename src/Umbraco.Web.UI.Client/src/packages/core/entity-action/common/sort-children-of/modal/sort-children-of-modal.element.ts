import type { UmbSortChildrenOfModalData, UmbSortChildrenOfModalValue } from './sort-children-of-modal.token.js';
import type { PropertyValueMap } from '@umbraco-cms/backoffice/external/lit';
import { html, customElement, css, state, repeat, nothing } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { createExtensionApiByAlias } from '@umbraco-cms/backoffice/extension-registry';
import type { UmbTreeRepository, UmbUniqueTreeItemModel } from '@umbraco-cms/backoffice/tree';
import type { UmbItemRepository } from '@umbraco-cms/backoffice/repository';
import { UmbPaginationManager } from '@umbraco-cms/backoffice/utils';
import { observeMultiple } from '@umbraco-cms/backoffice/observable-api';

const elementName = 'umb-sort-children-of-modal';

@customElement(elementName)
export class UmbSortChildrenOfModalElement extends UmbModalBaseElement<
	UmbSortChildrenOfModalData,
	UmbSortChildrenOfModalValue
> {
	@state()
	_children: Array<UmbUniqueTreeItemModel> = [];

	@state()
	_currentPage = 1;

	@state()
	_totalPages = 1;

	#pagination = new UmbPaginationManager();

	#sorter = new UmbSorterController<UmbUniqueTreeItemModel>(this, {
		getUniqueOfElement: (element) => {
			return element.dataset.unique;
		},
		getUniqueOfModel: (modelEntry) => {
			return modelEntry.unique;
		},
		identifier: 'Umb.SorterIdentifier.SortChildrenOfModal',
		itemSelector: 'uui-ref-node',
		containerSelector: 'uui-ref-list',
		onChange: (params) => {
			this._children = params.model;
			this.requestUpdate('_items');
		},
	});

	constructor() {
		super();
		this.#pagination.setPageSize(2);

		this.observe(
			observeMultiple([this.#pagination.currentPage, this.#pagination.totalPages]),
			([currentPage, totalPages]) => {
				this._currentPage = currentPage;
				this._totalPages = totalPages;
			},
			'umbPaginationObserver',
		);
	}

	protected async firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): Promise<void> {
		super.firstUpdated(_changedProperties);

		/*
		if (!this.data?.itemRepositoryAlias) throw new Error('itemRepositoryAlias is required');
		const itemRepository = await createExtensionApiByAlias<UmbItemRepository<any>>(this, this.data.itemRepositoryAlias);
		*/

		this.#requestItems();
	}

	async #requestItems() {
		if (!this.data?.unique === undefined) throw new Error('unique is required');
		if (!this.data?.treeRepositoryAlias) throw new Error('treeRepositoryAlias is required');

		const treeRepository = await createExtensionApiByAlias<UmbTreeRepository<UmbUniqueTreeItemModel>>(
			this,
			this.data.treeRepositoryAlias,
		);

		const { data } = await treeRepository.requestTreeItemsOf({
			parentUnique: this.data.unique,
			skip: this.#pagination.getSkip(),
			take: this.#pagination.getPageSize(),
		});

		if (data) {
			this._children = [...this._children, ...data.items];
			this.#pagination.setTotalItems(data.total);
			this.#sorter.setModel(this._children);
		}
	}

	#onLoadMore(event: PointerEvent) {
		event.stopPropagation();
		if (this._currentPage >= this._totalPages) return;
		this.#pagination.setCurrentPageNumber(this._currentPage + 1);
		this.#requestItems();
	}

	async #onSubmit(event: PointerEvent) {
		event?.stopPropagation();
		if (!this.data?.sortChildrenOfRepositoryAlias) throw new Error('sortChildrenOfRepositoryAlias is required');
		const sortChildrenOfRepository = await createExtensionApiByAlias<any>(
			this,
			this.data.sortChildrenOfRepositoryAlias,
		);

		debugger;

		/*
		const { error } = await sortChildrenOfRepository.sortChildrenOf({ unique: this.data.unique });
		if (!error) {
			console.log('Sorted');
		}
		*/
	}

	render() {
		return html`
			<umb-body-layout headline=${'Sort Children'}>
				<uui-box> ${this.#renderChildren()} </uui-box>
				<uui-button slot="actions" label="Cancel" @click="${this._rejectModal}"></uui-button>
				<uui-button slot="actions" color="positive" look="primary" label="Sort"></uui-button>
			</umb-body-layout>
		`;
	}

	#renderChildren() {
		return html`
			<uui-ref-list>
				${repeat(
					this._children,
					(child) => child.unique,
					(child) => this.#renderChild(child),
				)}
			</uui-ref-list>

			${this._currentPage < this._totalPages
				? html`
						<uui-button id="loadMoreButton" look="secondary" @click=${this.#onLoadMore}
							>Load More (${this._currentPage}/${this._totalPages})</uui-button
						>
					`
				: nothing}
		`;
	}

	#renderChild(item: UmbUniqueTreeItemModel) {
		return html`<uui-ref-node .name=${item.name} data-unique=${item.unique}></uui-ref-node>`;
	}

	static styles = [
		UmbTextStyles,
		css`
			#loadMoreButton {
				width: 100%;
			}
		`,
	];
}

export { UmbSortChildrenOfModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		[elementName]: UmbSortChildrenOfModalElement;
	}
}

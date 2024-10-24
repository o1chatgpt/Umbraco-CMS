import type { UmbContentDetailModel, UmbElementValueModel } from '../types.js';
import { UmbContentWorkspaceDataManager } from '../manager/index.js';
import { UmbMergeContentVariantDataController } from '../controller/merge-content-variant-data.controller.js';
import type { UmbContentVariantPickerData, UmbContentVariantPickerValue } from '../variant-picker/index.js';
import type { UmbContentWorkspaceContext } from './content-workspace-context.interface.js';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbDetailRepository, UmbDetailRepositoryConstructor } from '@umbraco-cms/backoffice/repository';
import {
	UmbEntityDetailWorkspaceContextBase,
	UmbWorkspaceSplitViewManager,
	type UmbEntityDetailWorkspaceContextArgs,
	type UmbEntityDetailWorkspaceContextCreateArgs,
} from '@umbraco-cms/backoffice/workspace';
import {
	UmbContentTypeStructureManager,
	type UmbContentTypeModel,
	type UmbPropertyTypeModel,
} from '@umbraco-cms/backoffice/content-type';
import {
	UMB_INVARIANT_CULTURE,
	UmbVariantId,
	type UmbEntityVariantModel,
	type UmbEntityVariantOptionModel,
} from '@umbraco-cms/backoffice/variant';
import { UmbReadOnlyVariantStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbDataTypeItemRepositoryManager } from '@umbraco-cms/backoffice/data-type';
import { appendToFrozenArray, mergeObservables, UmbArrayState } from '@umbraco-cms/backoffice/observable-api';
import { UmbLanguageCollectionRepository, type UmbLanguageDetailModel } from '@umbraco-cms/backoffice/language';
import type { Observable } from '@umbraco-cms/backoffice/external/rxjs';
import { firstValueFrom } from '@umbraco-cms/backoffice/external/rxjs';
import {
	UMB_VALIDATION_CONTEXT,
	UMB_VALIDATION_EMPTY_LOCALIZATION_KEY,
	UmbDataPathVariantQuery,
	UmbValidationContext,
	UmbVariantsValidationPathTranslator,
	UmbVariantValuesValidationPathTranslator,
} from '@umbraco-cms/backoffice/validation';
import type { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import { UMB_MODAL_MANAGER_CONTEXT } from '@umbraco-cms/backoffice/modal';
import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import {
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent,
} from '@umbraco-cms/backoffice/entity-action';

export interface UmbContentDetailWorkspaceContextArgs<
	DetailModelType extends UmbContentDetailModel<VariantModelType>,
	ContentTypeDetailModelType extends UmbContentTypeModel = UmbContentTypeModel,
	VariantModelType extends UmbEntityVariantModel = DetailModelType extends { variants: UmbEntityVariantModel[] }
		? DetailModelType['variants'][0]
		: never,
	VariantOptionModelType extends UmbEntityVariantOptionModel = UmbEntityVariantOptionModel<VariantModelType>,
> extends UmbEntityDetailWorkspaceContextArgs {
	contentTypeDetailRepository: UmbDetailRepositoryConstructor<ContentTypeDetailModelType>;
	contentVariantScaffold: VariantModelType;
	saveModalToken?: UmbModalToken<UmbContentVariantPickerData<VariantOptionModelType>, UmbContentVariantPickerValue>;
}

export abstract class UmbContentDetailWorkspaceBase<
		DetailModelType extends UmbContentDetailModel<VariantModelType>,
		DetailRepositoryType extends UmbDetailRepository<DetailModelType> = UmbDetailRepository<DetailModelType>,
		ContentTypeDetailModelType extends UmbContentTypeModel = UmbContentTypeModel,
		VariantModelType extends UmbEntityVariantModel = DetailModelType extends { variants: UmbEntityVariantModel[] }
			? DetailModelType['variants'][0]
			: never,
		VariantOptionModelType extends UmbEntityVariantOptionModel = UmbEntityVariantOptionModel<VariantModelType>,
		CreateArgsType extends
			UmbEntityDetailWorkspaceContextCreateArgs<DetailModelType> = UmbEntityDetailWorkspaceContextCreateArgs<DetailModelType>,
	>
	extends UmbEntityDetailWorkspaceContextBase<DetailModelType, DetailRepositoryType, CreateArgsType>
	implements UmbContentWorkspaceContext<DetailModelType, ContentTypeDetailModelType, VariantModelType>
{
	public readonly IS_CONTENT_WORKSPACE_CONTEXT = true as const;

	public readonly readOnlyState = new UmbReadOnlyVariantStateManager(this);

	/* Content Data */
	protected override readonly _data = new UmbContentWorkspaceDataManager<DetailModelType, VariantModelType>(this);
	public override readonly entityType = this._data.createObservablePartOfCurrent((data) => data?.entityType);
	public override readonly unique = this._data.createObservablePartOfCurrent((data) => data?.unique);
	public readonly values = this._data.createObservablePartOfCurrent((data) => data?.values);
	public readonly variants = this._data.createObservablePartOfCurrent((data) => data?.variants ?? []);

	/* Content Type (Structure) Data */
	public readonly structure;
	public readonly variesByCulture;
	public readonly variesBySegment;
	public readonly varies;

	/* Data Type */
	readonly #dataTypeItemManager = new UmbDataTypeItemRepositoryManager(this);
	#dataTypeSchemaAliasMap = new Map<string, string>();

	#varies?: boolean;
	#variesByCulture?: boolean;
	#variesBySegment?: boolean;

	/* Split View */
	readonly splitView = new UmbWorkspaceSplitViewManager();

	/* Variant Options */
	// TODO: Optimize this so it uses either a App Language Context? [NL]
	#languageRepository = new UmbLanguageCollectionRepository(this);
	#languages = new UmbArrayState<UmbLanguageDetailModel>([], (x) => x.unique);
	/**
	 * @private
	 * @description - Should not be used by external code.
	 */
	public readonly languages = this.#languages.asObservable();

	public readonly variantOptions;

	#saveModalToken?: UmbModalToken<UmbContentVariantPickerData<VariantOptionModelType>, UmbContentVariantPickerValue>;

	constructor(
		host: UmbControllerHost,
		args: UmbContentDetailWorkspaceContextArgs<
			DetailModelType,
			ContentTypeDetailModelType,
			VariantModelType,
			VariantOptionModelType
		>,
	) {
		super(host, args);

		this._data.setVariantScaffold(args.contentVariantScaffold);
		this.#saveModalToken = args.saveModalToken;

		const contentTypeDetailRepository = new args.contentTypeDetailRepository(this);
		this.structure = new UmbContentTypeStructureManager<ContentTypeDetailModelType>(this, contentTypeDetailRepository);
		this.variesByCulture = this.structure.ownerContentTypeObservablePart((x) => x?.variesByCulture);
		this.variesBySegment = this.structure.ownerContentTypeObservablePart((x) => x?.variesBySegment);
		this.varies = this.structure.ownerContentTypeObservablePart((x) =>
			x ? x.variesByCulture || x.variesBySegment : undefined,
		);

		this.variantOptions = mergeObservables(
			[this.varies, this.variants, this.languages],
			([varies, variants, languages]) => {
				// TODO: When including segments, when be aware about the case of segment varying when not culture varying. [NL]
				if (varies === true) {
					return languages.map((language) => {
						return {
							variant: variants.find((x) => x.culture === language.unique),
							language,
							// TODO: When including segments, this object should be updated to include a object for the segment. [NL]
							// TODO: When including segments, the unique should be updated to include the segment as well. [NL]
							unique: language.unique, // This must be a variantId string!
							culture: language.unique,
							segment: null,
						} as VariantOptionModelType;
					});
				} else if (varies === false) {
					return [
						{
							variant: variants.find((x) => x.culture === null),
							language: languages.find((x) => x.isDefault),
							culture: null,
							segment: null,
							unique: UMB_INVARIANT_CULTURE, // This must be a variantId string!
						} as VariantOptionModelType,
					];
				}
				return [] as Array<VariantOptionModelType>;
			},
		);

		this.addValidationContext(new UmbValidationContext(this));
		new UmbVariantValuesValidationPathTranslator(this);
		new UmbVariantsValidationPathTranslator(this);

		this.observe(
			this.varies,
			(varies) => {
				this._data.setVaries(varies);
				this.#varies = varies;
			},
			null,
		);
		this.observe(
			this.variesByCulture,
			(varies) => {
				this._data.setVariesByCulture(varies);
				this.#variesByCulture = varies;
			},
			null,
		);
		this.observe(
			this.variesBySegment,
			(varies) => {
				this._data.setVariesBySegment(varies);
				this.#variesBySegment = varies;
			},
			null,
		);
		this.observe(
			this.structure.contentTypeDataTypeUniques,
			(dataTypeUniques: Array<string>) => {
				this.#dataTypeItemManager.setUniques(dataTypeUniques);
			},
			null,
		);
		this.observe(
			this.#dataTypeItemManager.items,
			(dataTypes) => {
				// Make a map of the data type unique and editorAlias:
				this.#dataTypeSchemaAliasMap = new Map(
					dataTypes.map((dataType) => {
						return [dataType.unique, dataType.propertyEditorSchemaAlias];
					}),
				);
			},
			null,
		);

		this.loadLanguages();
	}

	async loadLanguages() {
		// TODO: If we don't end up having a Global Context for languages, then we should at least change this into using a asObservable which should be returned from the repository. [Nl]
		const { data } = await this.#languageRepository.requestCollection({});
		this.#languages.setValue(data?.items ?? []);
	}

	getName(variantId?: UmbVariantId) {
		const variants = this._data.getCurrent()?.variants;
		if (!variants) return;
		if (variantId) {
			return variants.find((x) => variantId.compare(x))?.name;
		} else {
			return variants[0]?.name;
		}
	}

	setName(name: string, variantId?: UmbVariantId) {
		this._data.updateVariantData(variantId ?? UmbVariantId.CreateInvariant(), { name });
	}

	name(variantId?: UmbVariantId) {
		return this._data.createObservablePartOfCurrent(
			(data) => data?.variants?.find((x) => variantId?.compare(x))?.name ?? '',
		);
	}

	/* Variants */

	getVariesByCulture() {
		return this.#variesByCulture;
	}

	getVariesBySegment() {
		return this.#variesBySegment;
	}

	getVaries() {
		return this.#varies;
	}

	variantById(variantId: UmbVariantId) {
		return this._data.createObservablePartOfCurrent((data) => data?.variants?.find((x) => variantId.compare(x)));
	}

	getVariant(variantId: UmbVariantId) {
		return this._data.getCurrent()?.variants?.find((x) => variantId.compare(x));
	}

	async propertyStructureById(propertyId: string) {
		return this.structure.propertyStructureById(propertyId);
	}

	/* Values */

	getValues() {
		return this._data.getCurrent()?.values;
	}

	/**
	 * @function propertyValueByAlias
	 * @param {string} propertyAlias - The alias of the property
	 * @param {UmbVariantId} variantId - The variant
	 * @returns {Promise<Observable<ReturnType | undefined> | undefined>} - An observable for the value of the property
	 * @description Get an Observable for the value of this property.
	 */
	async propertyValueByAlias<PropertyValueType = unknown>(
		propertyAlias: string,
		variantId?: UmbVariantId,
	): Promise<Observable<PropertyValueType | undefined> | undefined> {
		return this._data.createObservablePartOfCurrent(
			(data) =>
				data?.values?.find((x) => x?.alias === propertyAlias && (variantId ? variantId.compare(x) : true))
					?.value as PropertyValueType,
		);
	}

	/**
	 * Get the current value of the property with the given alias and variantId.
	 * @param {string} alias - The alias of the property
	 * @param {UmbVariantId | undefined} variantId - The variant id of the property
	 * @returns {ReturnType | undefined} The value or undefined if not set or found.
	 */
	getPropertyValue<ReturnType = unknown>(alias: string, variantId?: UmbVariantId) {
		const currentData = this._data.getCurrent();
		if (currentData) {
			const newDataSet = currentData.values?.find(
				(x) => x.alias === alias && (variantId ? variantId.compare(x) : true),
			);
			return newDataSet?.value as ReturnType;
		}
		return undefined;
	}

	async setPropertyValue<ValueType = unknown>(alias: string, value: ValueType, variantId?: UmbVariantId) {
		this.initiatePropertyValueChange();
		variantId ??= UmbVariantId.CreateInvariant();
		const property = await this.structure.getPropertyStructureByAlias(alias);

		if (!property) {
			throw new Error(`Property alias "${alias}" not found.`);
		}

		const editorAlias = this.#dataTypeSchemaAliasMap.get(property.dataType.unique);
		if (!editorAlias) {
			throw new Error(`Editor Alias of "${property.dataType.unique}" not found.`);
		}

		const entry = { ...variantId.toObject(), alias, editorAlias, value } as UmbElementValueModel;

		const currentData = this.getData();
		if (currentData) {
			const values = appendToFrozenArray(
				currentData.values ?? [],
				entry,
				(x) => x.alias === alias && variantId!.compare(x),
			);
			this._data.updateCurrent({ values });

			// TODO: We should move this type of logic to the act of saving [NL]
			this._data.ensureVariantData(variantId);
		}
		this.finishPropertyValueChange();
	}

	initiatePropertyValueChange() {
		this._data.initiatePropertyValueChange();
	}

	finishPropertyValueChange = () => {
		this._data.finishPropertyValueChange();
	};

	protected async _determineVariantOptions() {
		const options = await firstValueFrom(this.variantOptions);

		const activeVariants = this.splitView.getActiveVariants();
		const activeVariantIds = activeVariants.map((activeVariant) => UmbVariantId.Create(activeVariant));
		const changedVariantIds = this._data.getChangedVariants();
		const selectedVariantIds = activeVariantIds.concat(changedVariantIds);

		// Selected can contain entries that are not part of the options, therefor the modal filters selection based on options.
		const readOnlyCultures = this.readOnlyState.getStates().map((s) => s.variantId.culture);
		let selected = selectedVariantIds.map((x) => x.toString()).filter((v, i, a) => a.indexOf(v) === i);
		selected = selected.filter((x) => readOnlyCultures.includes(x) === false);

		return {
			options,
			selected,
		};
	}

	protected _readOnlyLanguageVariantsFilter = (option: VariantOptionModelType) => {
		const readOnlyCultures = this.readOnlyState.getStates().map((s) => s.variantId.culture);
		return readOnlyCultures.includes(option.culture) === false;
	};

	/* validation */
	protected async _runMandatoryValidationForSaveData(saveData: DetailModelType) {
		// Check that the data is valid before we save it.
		// Check variants have a name:
		const variantsWithoutAName = saveData.variants.filter((x) => !x.name);
		if (variantsWithoutAName.length > 0) {
			const validationContext = await this.getContext(UMB_VALIDATION_CONTEXT);
			variantsWithoutAName.forEach((variant) => {
				validationContext.messages.addMessage(
					'client',
					`$.variants[${UmbDataPathVariantQuery(variant)}].name`,
					UMB_VALIDATION_EMPTY_LOCALIZATION_KEY,
				);
			});
			throw new Error('All variants must have a name');
		}
	}

	public override requestSubmit() {
		return this.#handleSubmit();
	}

	public override submit() {
		return this.#handleSubmit();
	}

	public override invalidSubmit() {
		return this.#handleSubmit();
	}

	async #handleSubmit() {
		const data = this.getData();
		if (!data) {
			throw new Error('Data is missing');
		}

		const { options, selected } = await this._determineVariantOptions();

		let variantIds: Array<UmbVariantId> = [];

		// If there is only one variant, we don't need to open the modal.
		if (options.length === 0) {
			throw new Error('No variants are available');
		} else if (options.length === 1) {
			// If only one option we will skip ahead and save the content with the only variant available:
			variantIds.push(UmbVariantId.Create(options[0]));
		} else if (this.#saveModalToken) {
			// If there are multiple variants, we will open the modal to let the user pick which variants to save.
			const modalManagerContext = await this.getContext(UMB_MODAL_MANAGER_CONTEXT);
			const result = await modalManagerContext
				.open(this, this.#saveModalToken, {
					data: {
						options,
						pickableFilter: this._readOnlyLanguageVariantsFilter,
					},
					value: { selection: selected },
				})
				.onSubmit()
				.catch(() => undefined);

			if (!result?.selection.length) return;

			variantIds = result?.selection.map((x) => UmbVariantId.FromString(x)) ?? [];
		} else {
			throw new Error('No variant picker modal token is set. There are multiple variants to save. Cannot proceed.');
		}

		const saveData = await this._data.constructData(variantIds);
		await this._runMandatoryValidationForSaveData(saveData);
		await this._performCreateOrUpdate(variantIds, saveData);
	}

	protected async _performCreateOrUpdate(variantIds: Array<UmbVariantId>, saveData: DetailModelType) {
		if (this.getIsNew()) {
			await this.#create(variantIds, saveData);
		} else {
			await this.#update(variantIds, saveData);
		}
	}

	async #create(variantIds: Array<UmbVariantId>, saveData: DetailModelType) {
		if (!this._detailRepository) throw new Error('Detail repository is not set');

		const parent = this.getParent();
		if (!parent) throw new Error('Parent is not set');

		const { data, error } = await this._detailRepository.create(saveData, parent.unique);
		if (!data || error) {
			throw new Error('Error creating content');
		}

		this.setIsNew(false);
		this._data.setPersisted(data);
		// TODO: Only update the variants that was chosen to be saved:
		const currentData = this._data.getCurrent();

		const variantIdsIncludingInvariant = [...variantIds, UmbVariantId.CreateInvariant()];

		const newCurrentData = await new UmbMergeContentVariantDataController(this).process(
			currentData,
			data,
			variantIds,
			variantIdsIncludingInvariant,
		);
		this._data.setCurrent(newCurrentData);

		const eventContext = await this.getContext(UMB_ACTION_EVENT_CONTEXT);
		const event = new UmbRequestReloadChildrenOfEntityEvent({
			entityType: parent.entityType,
			unique: parent.unique,
		});
		eventContext.dispatchEvent(event);
	}

	async #update(variantIds: Array<UmbVariantId>, saveData: DetailModelType) {
		if (!this._detailRepository) throw new Error('Detail repository is not set');

		const { data, error } = await this._detailRepository.save(saveData);
		if (!data || error) {
			throw new Error('Error saving content');
		}

		this._data.setPersisted(data);
		// TODO: Only update the variants that was chosen to be saved:
		const currentData = this._data.getCurrent();

		const variantIdsIncludingInvariant = [...variantIds, UmbVariantId.CreateInvariant()];

		const newCurrentData = await new UmbMergeContentVariantDataController(this).process(
			currentData,
			data,
			variantIds,
			variantIdsIncludingInvariant,
		);
		this._data.setCurrent(newCurrentData);

		const eventContext = await this.getContext(UMB_ACTION_EVENT_CONTEXT);
		const event = new UmbRequestReloadStructureForEntityEvent({
			entityType: this.getEntityType(),
			unique: this.getUnique()!,
		});

		eventContext.dispatchEvent(event);
	}

	public override destroy(): void {
		this.structure.destroy();
		this.#languageRepository.destroy();
		super.destroy();
	}
}

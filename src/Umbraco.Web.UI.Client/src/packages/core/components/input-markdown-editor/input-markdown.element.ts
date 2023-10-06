import { KeyCode, KeyMod } from 'monaco-editor';
import { UmbMediaPickerContext } from '../../../media/media/components/input-media/input-media.context.js';
import { UmbCodeEditorController, UmbCodeEditorElement, loadCodeEditor } from '@umbraco-cms/backoffice/code-editor';
import { css, html, customElement, query, property } from '@umbraco-cms/backoffice/external/lit';
import { FormControlMixin } from '@umbraco-cms/backoffice/external/uui';
import { UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import { UmbLitElement } from '@umbraco-cms/internal/lit-element';

/**
 * @element umb-input-markdown
 * @fires change - when the value of the input changes
 */

@customElement('umb-input-markdown')
export class UmbInputMarkdownElement extends FormControlMixin(UmbLitElement) {
	protected getFormElement() {
		return this._codeEditor;
	}

	@property({ type: Boolean })
	preview?: boolean;

	#isCodeEditorReady = new UmbBooleanState(false);
	#editor?: UmbCodeEditorController;

	@query('umb-code-editor')
	_codeEditor?: UmbCodeEditorElement;

	#mediaPicker = new UmbMediaPickerContext(this);

	constructor() {
		super();
		this.#loadCodeEditor();
	}

	async #loadCodeEditor() {
		try {
			await loadCodeEditor();
			this.#isCodeEditorReady.next(true);

			this.#editor = this._codeEditor?.editor;

			this.#editor?.updateOptions({
				lineNumbers: false,
				minimap: false,
				folding: false,
			});
			this.#loadActions();
		} catch (error) {
			console.error(error);
		}
	}

	async #loadActions() {
		// Going to base the keybindings of a Markdown Shortcut plugin https://marketplace.visualstudio.com/items?itemName=robole.markdown-shortcuts#shortcuts
		// TODO: Find a way to have "double" keybindings (ctrl+m+ctrl+c for `code`, rather than simple ctrl+c as its taken by OS to copy things)
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H1',
			id: 'h1',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit1],
			run: () => this._insertAtCurrentLine('#'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H2',
			id: 'h2',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit2],
			run: () => this._insertAtCurrentLine('##'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H3',
			id: 'h3',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit3],
			run: () => this._insertAtCurrentLine('###'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H4',
			id: 'h4',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit4],
			run: () => this._insertAtCurrentLine('####'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H5',
			id: 'h5',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit5],
			run: () => this._insertAtCurrentLine('#####'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Heading H6',
			id: 'h6',
			keybindings: [KeyMod.CtrlCmd | KeyCode.Digit6],
			run: () => this._insertAtCurrentLine('######'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Bold Text',
			id: 'b',
			keybindings: [KeyMod.CtrlCmd | KeyCode.KeyB],
			run: () => this._insertBetweenSelection('**', '**', 'Your Bold Text'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Italic Text',
			id: 'i',
			keybindings: [KeyMod.CtrlCmd | KeyCode.KeyI],
			run: () => this._insertBetweenSelection('*', '*', 'Your Italic Text'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Quote',
			id: 'q',
			keybindings: [KeyMod.CtrlCmd | KeyCode.KeyQ],
			run: () => this._insertAtCurrentLine('> '),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Ordered List',
			id: 'ol',
			keybindings: [KeyMod.CtrlCmd | KeyCode.KeyO],
			run: () => this._insertAtCurrentLine('1. '),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Unordered List',
			id: 'ul',
			keybindings: [KeyMod.CtrlCmd | KeyCode.KeyU],
			run: () => this._insertAtCurrentLine('- '),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Code',
			id: 'code',
			//keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM | KeyMod.CtrlCmd | KeyCode.KeyC],
			run: () => this._insertBetweenSelection('`', '`', 'Code'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Fenced Code',
			id: 'fenced-code',
			//keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM | KeyMod.CtrlCmd | KeyCode.KeyF],
			run: () => this._insertBetweenSelection('```', '```', 'Code'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Line',
			id: 'line',
			//keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM | KeyMod.CtrlCmd | KeyCode.KeyC],
			run: () => this._insertAtCurrentLine('---\n'),
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Link',
			id: 'link',
			//keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM | KeyMod.CtrlCmd | KeyCode.KeyC],
			run: () => this._insertBetweenSelection('[', '](https://example.com)', 'title'),
			// TODO: Open in modal
		});
		this.#editor?.monacoEditor?.addAction({
			label: 'Add Image',
			id: 'image',
			//keybindings: [KeyMod.CtrlCmd | KeyCode.KeyM | KeyMod.CtrlCmd | KeyCode.KeyC],
			run: () => this._insertBetweenSelection('![', '](example.png)', 'alt text'),
			// TODO: Open in modal
		});
	}

	private _focusEditor(): void {
		// If we press one of the action buttons manually (which is outside the editor), we need to focus the editor again.
		this.#editor?.monacoEditor?.focus();
	}

	private _insertBetweenSelection(startValue: string, endValue: string, placeholder?: string) {
		this._focusEditor();
		const selection = this.#editor?.getSelections()[0];
		if (!selection) return;

		const selectedValue = this.#editor?.getValueInRange({
			startLineNumber: selection.startLineNumber,
			endLineNumber: selection.endLineNumber,
			startColumn: selection.startColumn - startValue.length,
			endColumn: selection.endColumn + endValue.length,
		});
		if (selectedValue?.startsWith(startValue) && selectedValue.endsWith(endValue)) {
			//Cancel previous insert
			this.#editor?.select({ ...selection, startColumn: selection.startColumn + startValue.length });
			this.#editor?.monacoEditor?.executeEdits('', [
				{
					range: {
						startColumn: selection.startColumn - startValue.length,
						startLineNumber: selection.startLineNumber,
						endColumn: selection.startColumn,
						endLineNumber: selection.startLineNumber,
					},
					text: '',
				},
				{
					range: {
						startColumn: selection.endColumn + startValue.length,
						startLineNumber: selection.startLineNumber,
						endColumn: selection.endColumn,
						endLineNumber: selection.startLineNumber,
					},
					text: '',
				},
			]);
		} else {
			// Insert
			this.#editor?.insertAtPosition(startValue, {
				lineNumber: selection.startLineNumber,
				column: selection.startColumn,
			});
			this.#editor?.insertAtPosition(endValue, {
				lineNumber: selection.endLineNumber,
				column: selection.endColumn + startValue.length,
			});
		}

		// if no text were selected when action fired
		if (selection.startColumn === selection.endColumn && selection.startLineNumber === selection.endLineNumber) {
			if (placeholder) {
				this.#editor?.insertAtPosition(placeholder, {
					lineNumber: selection.startLineNumber,
					column: selection.startColumn + startValue.length,
				});
			}
			this.#editor?.select({
				startLineNumber: selection.startLineNumber,
				endLineNumber: selection.endLineNumber,
				startColumn: selection.startColumn + startValue.length,
				endColumn: selection.startColumn + startValue.length + (placeholder?.length ?? 0),
			});
		}
	}

	private _insertAtCurrentLine(value: string) {
		this._focusEditor();
		const selection = this.#editor?.getSelections()[0];
		if (!selection) return;

		const previousLineValue = this.#editor?.getValueInRange({
			...selection,
			startLineNumber: selection.startLineNumber - 1,
		});
		const lineValue = this.#editor?.getValueInRange({ ...selection, startColumn: 1 });

		// Regex: check if the line starts with a positive number followed by dot and a space
		if (lineValue?.startsWith(value) || lineValue?.match(/^[1-9]\d*\.\s.*/)) {
			// Cancel previous insert
			this.#editor?.monacoEditor?.executeEdits('', [
				{
					range: {
						startColumn: 1,
						startLineNumber: selection.startLineNumber,
						endColumn: 1 + value.length,
						endLineNumber: selection.startLineNumber,
					},
					text: '',
				},
			]);
		} else if (value.match(/^[1-9]\d*\.\s.*/) && previousLineValue?.match(/^[1-9]\d*\.\s.*/)) {
			// Check if the PREVIOUS line starts with a positive number followed by dot and a space. If yes, get that number.
			const previousNumber = parseInt(previousLineValue, 10);
			this.#editor?.insertAtPosition(`${previousNumber + 1}. `, {
				lineNumber: selection.startLineNumber,
				column: 1,
			});
		} else {
			// Insert
			this.#editor?.insertAtPosition(value, {
				lineNumber: selection.startLineNumber,
				column: 1,
			});
		}
	}

	private _renderBasicActions() {
		return html`<div>
				<uui-button
					compact
					look="secondary"
					label="Heading"
					title="Heading"
					@click=${() => this.#editor?.monacoEditor?.getAction('h1')?.run()}>
					H
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Bold"
					title="Bold"
					@click=${() => this.#editor?.monacoEditor?.getAction('b')?.run()}>
					B
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Italic"
					title="Italic"
					@click=${() => this.#editor?.monacoEditor?.getAction('i')?.run()}>
					I
				</uui-button>
			</div>
			<div>
				<uui-button
					compact
					look="secondary"
					label="Quote"
					title="Quote"
					@click=${() => this.#editor?.monacoEditor?.getAction('q')?.run()}>
					<uui-icon name="umb:quote"></uui-icon>
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Ordered List"
					title="Ordered List"
					@click=${() => this.#editor?.monacoEditor?.getAction('ol')?.run()}>
					<uui-icon name="umb:ordered-list"></uui-icon>
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Unordered List"
					title="Unordered List"
					@click=${() => this.#editor?.monacoEditor?.getAction('ul')?.run()}>
					<uui-icon name="umb:bulleted-list"></uui-icon>
				</uui-button>
			</div>
			<div>
				<uui-button
					compact
					look="secondary"
					label="Fenced Code"
					title="Fenced Code"
					@click=${() => this.#editor?.monacoEditor?.getAction('fenced-code')?.run()}>
					<uui-icon name="umb:code"></uui-icon>
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Line"
					title="Line"
					@click=${() => this.#editor?.monacoEditor?.getAction('line')?.run()}>
					<uui-icon name="umb:width"></uui-icon>
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Link"
					title="Link"
					@click=${() => this.#editor?.monacoEditor?.getAction('link')?.run()}>
					<uui-icon name="umb:link"></uui-icon>
				</uui-button>
				<uui-button
					compact
					look="secondary"
					label="Image"
					title="Image"
					@click=${() => this.#editor?.monacoEditor?.getAction('image')?.run()}>
					<uui-icon name="umb:picture"></uui-icon>
				</uui-button>
			</div>
			<div>
				<uui-button
					compact
					label="Press F1 for all actions"
					title="Press F1 for all actions"
					@click=${() => {
						this._focusEditor();
						this.#editor?.monacoEditor?.trigger('', 'editor.action.quickCommand', '');
					}}>
					<uui-key>F1</uui-key>
				</uui-button>
			</div>`;
	}

	onKeyPress(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== 'Tab') return;

		const selection = this.#editor?.getSelections()[0];
		if (!selection) return;

		const lineValue = this.#editor?.getValueInRange({ ...selection, startColumn: 1 });
		if (!lineValue) return;

		if (e.key === 'Enter') {
			if (lineValue.startsWith('- ') && lineValue.length > 3) {
				requestAnimationFrame(() => this.#editor?.insert('- '));
			} else if (lineValue.match(/^[1-9]\d*\.\s.*/) && lineValue.length) {
				const previousNumber = parseInt(lineValue, 10);
				requestAnimationFrame(() => this.#editor?.insert(`${previousNumber + 1}. `));
			}
		}
	}

	render() {
		return html` <div id="actions">${this._renderBasicActions()}</div>
			<umb-code-editor language="markdown" .code=${this.value as string} @keypress=${this.onKeyPress}></umb-code-editor>
			${this.renderPreview()}`;
	}

	renderPreview() {
		if (!this.preview) return;
		return html`<div>TODO Preview</div>`;
	}

	static styles = [
		css`
			:host {
				display: flex;
				flex-direction: column;
			}
			#actions {
				background-color: var(--uui-color-background-alt);
				display: flex;
				gap: var(--uui-size-6);
			}

			#actions div {
				display: flex;
				gap: var(--uui-size-1);
			}

			#actions div:last-child {
				margin-left: auto;
			}

			umb-code-editor {
				height: 200px;
				border-radius: var(--uui-border-radius);
				border: 1px solid var(--uui-color-divider-emphasis);
			}

			uui-button {
				width: 50px;
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'umb-input-markdown': UmbInputMarkdownElement;
	}
}

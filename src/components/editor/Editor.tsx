import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { conf, language } from './pipesql';
import { theme } from './theme';
import { TableDefinition } from '../../lib/types';


// @ts-ignore
self.MonacoEnvironment = {
	// @ts-ignore
	getWorker: function (_, label) {

		console.log("getWorker", label);

		if (label === 'json') {
			// @ts-ignore
			return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url), { type: 'module' });
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			// @ts-ignore
			return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url), { type: 'module' });
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			// @ts-ignore
			return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url), { type: 'module' });
		}
		if (label === 'typescript' || label === 'javascript') {
			// @ts-ignore
			return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url), { type: 'module' });
		}
		// @ts-ignore
		//		return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' });

		// TODO 
		// no webworker now, there is some issue with bundling js files

		return null;
	}
};

interface EditorProps {
	onChange?: (value: string) => void;
	startDate?: string;
	endDate?: string;
	query?: string;
	tableDefinitions?: TableDefinition[];
	tableName?: string;
	onGlyphClick?: (lineNumber: number, isPlay: boolean) => void;
	onEnter?: () => void;
	onAiModalOpen?: (position: { x: number, y: number }) => void;
}

// Move provider registration outside the component
let inlayHintsProvider: monaco.IDisposable | null = null;

// Register provider once
function registerInlayProvider(startDate?: string, endDate?: string) {
	if (inlayHintsProvider) {
		inlayHintsProvider.dispose();
	}

	inlayHintsProvider = monaco.languages.registerInlayHintsProvider("pipe-sql", {
		provideInlayHints(model, range, token) {
			const lines = model.getValue().split('\n');
			const hints: monaco.languages.InlayHint[] = [];

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];

				const startPos = line.match(/\$start\b/)?.index ?? -1;
				if (startPos !== -1) {
					hints.push({
						kind: monaco.languages.InlayHintKind.Type,
						position: { column: startPos + "$start".length + 1, lineNumber: i + 1 },
						label: `(${startDate})`,
						tooltip: "Start Date",
						paddingLeft: true,
						paddingRight: true,
					});
				}

				const endPos = line.match(/\$end\b/)?.index ?? -1;
				if (endPos !== -1) {
					hints.push({
						kind: monaco.languages.InlayHintKind.Type,
						position: { column: endPos + "$end".length + 1, lineNumber: i + 1 },
						label: `(${endDate})`,
						tooltip: "End Date",
						paddingLeft: true,
						paddingRight: true,
					});
				}
			}
			return { hints, dispose: () => { } };
		},
		onDidChangeInlayHints: (event: any) => {
			return { dispose: () => { } };
		}
	});
}

// Add these interfaces at the top
interface GlyphInfo {
	lineNumber: number;
	type: 'play' | 'pause';
}

function addGlyphDecorations(editor: monaco.editor.IStandaloneCodeEditor, glyphs: GlyphInfo[]) {
	const decorations = glyphs.map(glyph => ({
		range: new monaco.Range(glyph.lineNumber, 1, glyph.lineNumber, 1),
		options: {
			isWholeLine: false,
			glyphMarginClassName: `glyph-${glyph.type}`,
			stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
		}
	}));

	return editor.createDecorationsCollection(decorations);
}

function initPipeSQLLanguage() {
	// Register a new language
	monaco.languages.register({ id: "pipe-sql" });

	monaco.languages.setMonarchTokensProvider("pipe-sql", language);
	monaco.languages.setLanguageConfiguration("pipe-sql", conf);

	monaco.editor.defineTheme("pipe-sql-theme", theme);

	console.log("initPipeSQLLanguage initialized");
}

export const Editor: React.FC<EditorProps> = ({ query, onChange, startDate, endDate, tableDefinitions, tableName, onGlyphClick, onEnter, onAiModalOpen }) => {	
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
	const decorationCollection = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
	const initializedRef = useRef(false);
	const tableDefinitionsRef = useRef<TableDefinition[]>(tableDefinitions || []);
	const tableNameRef = useRef<string>(tableName || '');
	const [editorHeight, setEditorHeight] = useState("250px");
	const lastMousePosition = useRef({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const isDraggingRef = useRef(false);

	useEffect(() => {
		tableDefinitionsRef.current = tableDefinitions || [];
		tableNameRef.current = tableName || '';
	}, [tableDefinitions, tableName]);

	useEffect(() => {
		registerInlayProvider(startDate, endDate);
		return () => {
			if (inlayHintsProvider) {
				inlayHintsProvider.dispose();
			}
		};
	}, [startDate, endDate]);

	// Function to apply decorations
	const applyDecorations = useCallback(() => {
		if (!editorRef.current || !query) {
			return;
		}

		// Clear previous decorations
		if (decorationCollection.current) {
			decorationCollection.current.clear();
		}

		const lines = query.split('\n');
		const glyphs: GlyphInfo[] = [];

		lines.forEach((line, index) => {
			const lineNumber = index + 1;
			const trimmedLine = line.trim();

			if (trimmedLine.startsWith('|>')) {
				glyphs.push({
					lineNumber,
					type: 'pause',
				});
			} else if (trimmedLine.startsWith('--|>')) {
				glyphs.push({
					lineNumber,
					type: 'play'
				});
			}
		});

		const lineCount = lines.length;
		const newHeight = Math.max(150, Math.min(500, lineCount * 24));
		setEditorHeight(`${newHeight}px`);

		// Store the new decoration collection
		decorationCollection.current = addGlyphDecorations(editorRef.current, glyphs);
	}, [query]);

	useEffect(() => {
		if (editorRef.current && query !== undefined) {
			const currentValue = editorRef.current.getValue();

			if (currentValue !== query) {
				editorRef.current.setValue(query);

				// Apply decorations after setting value
				setTimeout(() => {
					applyDecorations();
				}, 0);
			} else if (!initializedRef.current) {
				// Apply decorations on first load
				applyDecorations();
				initializedRef.current = true;
			}
		}
	}, [query, applyDecorations]);

	// Apply decorations when query changes
	useEffect(() => {
		if (editorRef.current && query) {
			applyDecorations();
		}

		return () => {
			if (decorationCollection.current) {
				decorationCollection.current.clear();
			}
		};
	}, [query, applyDecorations]);

	// Add mouse move listener to track position
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			lastMousePosition.current = { x: e.clientX, y: e.clientY };
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

	initPipeSQLLanguage();

	const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
		editorRef.current = editor;

		// Register language


		// Add command for Ctrl/Cmd + Enter
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
			if (onEnter) {
				onEnter();
			}
		});

		// Add click handler for the glyph margin
		editor.onMouseDown((e) => {
			if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
				const lineNumber = e.target.position?.lineNumber;
				if (lineNumber) {
					const line = editor.getModel()?.getLineContent(lineNumber) || '';
					const trimmedLine = line.trim();

					if (trimmedLine.startsWith('|>') || trimmedLine.startsWith('--|>')) {
						const glyphs = editor.getModel()?.getAllDecorations() || [];
						const glyph = glyphs.find(d =>
							d.range.startLineNumber === lineNumber &&
							(d.options.glyphMarginClassName?.includes('play') ||
								d.options.glyphMarginClassName?.includes('pause'))
						);

						if (glyph && onGlyphClick) {
							const isPlay = glyph.options.glyphMarginClassName?.includes('pause') || false;
							onGlyphClick(lineNumber, isPlay);
						}
					}
				}
			}
		});

		const askAICommand = editor.addCommand(
			0,
			function () {
				if (onAiModalOpen) {
					onAiModalOpen({
						x: lastMousePosition.current.x,
						y: lastMousePosition.current.y + 10
					});
				}
			},
			"ask-ai"
		);


		const addTimeRangeCommand = editor.addCommand(
			0,
			function () {
				const lines = editorRef.current?.getModel()?.getValue().split('\n');

				lines?.push("|> WHERE timestamp >= $start AND timestamp <= $end");

				if (onChange) {
					onChange(lines?.join('\n') || '');
				}

				console.log("add-time-range");
			},
			"add-time-range"
		);

		const addLimitCommand = editor.addCommand(
			0,
			function () {
				const lines = editorRef.current?.getModel()?.getValue().split('\n');

				lines?.push("|> LIMIT 100");

				if (onChange) {
					onChange(lines?.join('\n') || '');
				}

				console.log("add-limit");
			},
			"add-limit"
		);

		monaco.languages.registerCodeLensProvider("pipe-sql", {
			provideCodeLenses: function (model, token) {
				const value = model.getValue();
				const lines = value.split('\n');
				const lineNumber =1;

				const lens = []

				lens.push({
					range: {
						startLineNumber: lineNumber,	
						startColumn: 1,
						endLineNumber: lineNumber,
						endColumn: 1,
					},
					id: "Ask AI",
					command: {
						id: askAICommand || '', // Ensure id is never null
						title: "Ask AI",
					},
				});
				
				if (lines.length > 1) {
					const hasTimeRange = lines.some(line => line.includes('$start') || line.includes('$end'));
					
					if (!hasTimeRange) {
						lens.push({
							range: {
								startLineNumber: lineNumber,
								startColumn: 1,
								endLineNumber: lineNumber,
								endColumn: 1,
							},
							id: "Add time range",
							command: {
								id: addTimeRangeCommand || '',
								title: "Add time range",
							},
						});
					}
				}

				const hasLimit = lines.some(line => line.toLowerCase().includes('|> limit'));

				if (!hasLimit) {
					lens.push({
						range: {
							startLineNumber: lineNumber,
							startColumn: 1,
							endLineNumber: lineNumber,
							endColumn: 1,
						},
						id: "Add LIMIT",
						command: {
							id: addLimitCommand || '',
							title: "Add LIMIT",
						},
					});
				}

				return {
					lenses: lens,
					dispose: () => {},
				};
			},
			
			resolveCodeLens: function (model, codeLens, token) {
				return codeLens;
			},
		});

		// Register completion provider
		monaco.languages.registerCompletionItemProvider("pipe-sql", {
			provideCompletionItems: function (model, position) {
				try {
					let textUntilPosition = model.getValueInRange({
						startLineNumber: position.lineNumber,
						startColumn: 1,
						endLineNumber: position.lineNumber,
						endColumn: position.column,
					});

					let match = textUntilPosition.match(/^from\s+/i);

					if (match) {
						let word = model.getWordUntilPosition(position);
						let range = {
							startLineNumber: position.lineNumber,
							endLineNumber: position.lineNumber,
							startColumn: word.startColumn,
							endColumn: word.endColumn,
						};
						return {
							suggestions: createTableProposals(range),
						};
					}

					match = textUntilPosition.match(/^\|\>\s+(where|select|aggregate|order)\s+.*/i);

					if (match) {
						let word = model.getWordUntilPosition(position);
						let range = {
							startLineNumber: position.lineNumber,
							endLineNumber: position.lineNumber,
							startColumn: word.startColumn,
							endColumn: word.endColumn,
						};
						return {
							suggestions: createColumnProposals(range),
						};
					}

					match = textUntilPosition.match(/^\|\>\s+/i);
					if (match) {
						let word = model.getWordUntilPosition(position);
						let range = {
							startLineNumber: position.lineNumber,
							endLineNumber: position.lineNumber,
							startColumn: word.startColumn,
							endColumn: word.endColumn,
						};
						return {
							suggestions: createCommandProposals(range),
						};
					}

					return { suggestions: [] };
				} catch (error) {
					return { suggestions: [] };
				}
			},
		});

		// Add event listener to editor
		editor.onMouseDown((e) => {
			if (e.event.rightButton) {
				lastMousePosition.current = {
					x: e.event.browserEvent.clientX,
					y: e.event.browserEvent.clientY + 10
				};
			}
		});

		// Apply initial decorations
		if (query) {
			applyDecorations();
		}
	};

	const createTableProposals = (range: monaco.IRange) => {
		if (!tableDefinitionsRef.current || !Array.isArray(tableDefinitionsRef.current) || tableDefinitionsRef.current.length === 0) {
			return [];
		}

		try {
			const names = tableDefinitionsRef.current.map((table) => table.table);

			const suggestions = [];
			for (const name of names) {
				suggestions.push({
					label: name,
					kind: monaco.languages.CompletionItemKind.Keyword,
					insertText: name,
					range: range
				});
			}

			return suggestions;
		} catch (error) {
			console.error("Error creating table proposals:", error);
			return [];
		}
	};

	const createColumnProposals = (range: monaco.IRange) => {
		if (!tableDefinitionsRef.current || !Array.isArray(tableDefinitionsRef.current) || tableDefinitionsRef.current.length === 0) {
			return [];
		}

		try {
			const table = tableDefinitionsRef.current.find(t => t.table === tableNameRef.current);

			if (!table || !table.columns || !Array.isArray(table.columns)) {
				return [];
			}

			const columns = table.columns;

			const suggestions = columns.map(c => ({
				label: c,
				kind: monaco.languages.CompletionItemKind.Field,
				insertText: c,
				range: range
			}));

			suggestions.push({
				label: '$end',
				kind: monaco.languages.CompletionItemKind.Variable,
				insertText: "end",
				range: range
			});

			suggestions.push({
				label: '$start',
				kind: monaco.languages.CompletionItemKind.Variable,
				insertText: "start",
				range: range
			});

			suggestions.push({
				label: "*",
				kind: monaco.languages.CompletionItemKind.Constant,
				insertText: "*",
				range: range
			});

			return suggestions;
		} catch (error) {
			console.error("Error creating column proposals:", error);
			return [];
		}
	};

	const createCommandProposals = (range: monaco.IRange) => {
		return [
			{ label: 'from', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'from', range: range },
			{ label: 'limit', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'limit', range: range },
			{ label: 'select', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'select', range: range },
			{ label: 'where', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'where', range: range },
			{ label: 'order', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'order', range: range },
			{ label: 'aggregate', kind: monaco.languages.CompletionItemKind.Keyword, insertText: 'aggregate', range: range },
		];
	};

	const handleChange = (value: string | undefined) => {
		if (onChange && value !== undefined) {
			onChange(value);
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		isDraggingRef.current = true;
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!isDraggingRef.current || !containerRef.current) return;

		const containerRect = containerRef.current.getBoundingClientRect();
		const newHeight = Math.max(150, e.clientY - containerRect.top);
		setEditorHeight(`${newHeight}px`);

		// Trigger Monaco editor layout update
		if (editorRef.current) {
			editorRef.current.layout();
		}
	}, []);

	const handleMouseUp = useCallback(() => {
		isDraggingRef.current = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	}, [handleMouseMove]);

	useEffect(() => {
		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	return (
		<div ref={containerRef} className="EditorContainer" style={{ position: 'relative' }}>
			<MonacoEditor
				height={editorHeight}
				language="pipe-sql"
				theme="pipe-sql-theme"
				value={query}
				options={{
					fontSize: 16,
					lineHeight: 24,
					glyphMargin: true,
					minimap: { enabled: false },
					scrollbar: {
						horizontal: 'hidden'
					},
					overviewRulerBorder: false,
					scrollBeyondLastLine: false,
					automaticLayout: true,
				}}
				onChange={handleChange}
				onMount={handleEditorDidMount}
			/>
			<div 
				className="resize-handle"
				onMouseDown={handleMouseDown}
				style={{
					position: 'absolute',
					bottom: 0,
					right: 0,
					width: '20px',
					height: '20px',
					cursor: 'se-resize',
					background: 'transparent'
				}}
			/>
		</div>
	);
};

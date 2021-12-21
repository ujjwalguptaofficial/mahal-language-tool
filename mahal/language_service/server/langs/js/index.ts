import { CompletionEntry, Node, CompletionsTriggerCharacter, displayPartsToString, LanguageService, NavigationBarItem, Program, ScriptElementKind, SemanticClassificationFormat, TextSpan, SymbolFlags, isIdentifier, isPropertyAccessExpression, IndentStyle, CancellationToken, flattenDiagnosticMessageText, getSupportedCodeFixes, FileTextChanges, UserPreferences, FormatCodeSettings } from "typescript";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, Range, CompletionItemKind, CompletionItemTag, CompletionList, Hover, InsertTextFormat, Location, MarkupContent, MarkupKind, Position, SignatureInformation, ParameterInformation, SignatureHelp, SymbolInformation, DocumentHighlightKind, DocumentHighlight, Definition, FormattingOptions, TextEdit, DiagnosticTag, Diagnostic, CodeActionContext, CodeAction, CodeActionKind } from "vscode-languageserver/node";
import * as Previewer from '../../utils/previewer';
import { fromTsDiagnosticCategoryToDiagnosticSeverity, getURLFromPath, isMahalFile, toSymbolKind } from "../../utils";
import { SEMANTIC_TOKEN_CONTENT_LENGTH_LIMIT, TokenEncodingConsts, TokenModifier, TokenType } from "../../constants";
import { CodeActionData, CodeActionDataKind, ISemanticTokenOffsetData, RefactorActionData } from "../../interfaces";
import { MahalDoc } from "../../models";
import { LanguageId } from "../../types";
import { getCodeActionKind } from "./code_action_kind_converter";
import { MahalLang } from "../../abstracts";
import { DocManager } from "../../managers";
import { getRefactorFix } from "./get_refactor_fix";
import { getOrganizeImportFix } from "./get_organize_import_fix";

export class JsLang extends MahalLang {
    readonly id: LanguageId = 'javascript';

    symbolsCacheForHTML: SymbolInformation[] = [];

    supportedCodeFixCodes: Set<number>;

    preferences: UserPreferences = {
        includeCompletionsForImportStatements: true,
        includePackageJsonAutoImports: "on"
    };

    formatOptions: FormatCodeSettings;

    constructor(
        public langService: LanguageService,
        docManager: DocManager,
    ) {
        super(docManager);
        this.supportedCodeFixCodes = new Set(
            getSupportedCodeFixes().map(Number).filter(x => !isNaN(x))
        );
        const editorConfig = this.docManager.editorConfig;
        this.formatOptions = {
            tabSize: editorConfig.tabSize,
            indentSize: editorConfig.indentSize,
            convertTabsToSpaces: editorConfig.script.format.convertTabsToSpaces,
            insertSpaceAfterCommaDelimiter: true
        }
    }

    doComplete(document: MahalDoc, position: Position) {
        this.symbolsCacheForHTML = [];

        const uri = document.uri;
        // const { doc: savedDoc, regions } = this.getDoc(document);
        const region = this.getRegion(document);//regions[0];
        const offset = document.offsetAt(position) - region.start;
        const fileText = document.getText();

        // console.log("saved fileText", fileText.split(""), fileText.length, `'${fileText}'`);

        const triggerChar = fileText[offset - 1];
        if (NON_SCRIPT_TRIGGERS.includes(triggerChar)) {
            console.log("returning empty");
            return Promise.resolve(
                CompletionList.create([], false)
            )
        }
        const triggerCharValue = getTsTriggerCharacter(triggerChar);
        // console.log("offset", offset);

        const result = this.langService.getCompletionsAtPosition(
            this.getFileName(uri), offset,
            {
                allowIncompleteCompletions: true,
                allowTextChangesInNewFiles: true,
                includeAutomaticOptionalChainCompletions: true,
                includeCompletionsWithInsertText: true,
                triggerCharacter: triggerCharValue,
                includeCompletionsForImportStatements: true,
                includeCompletionsForModuleExports: true,
                includeCompletionsWithSnippetText: true,
                includePackageJsonAutoImports: "auto",
            }
        )

        const entries = result ? result.entries : [];
        // console.log("entries", entries.length);
        const items = entries.map(entry => {
            const { detail, label } = getLabelAndDetailFromCompletionEntry(entry);
            const completionItem: CompletionItem = {

                label: label,
                detail: detail,
                sortText: entry.sortText,
                insertText: entry.insertText,
                preselect: entry.isRecommended,
                filterText: getFilterText(entry.insertText),
                kind: toCompletionItemKind(entry.kind),
                data: {
                    uri: uri,
                    offset,
                    source: entry.source,
                    tsData: entry.data,
                    position: position
                }

            };
            if (entry.kindModifiers) {
                const kindModifiers = parseKindModifier(
                    entry.kindModifiers ?? ''
                );
                if (kindModifiers.optional) {
                    if (!completionItem.insertText) {
                        completionItem.insertText = completionItem.label;
                    }
                    if (!completionItem.filterText) {
                        completionItem.filterText = completionItem.label;
                    }
                    completionItem.label += '?';
                }
                if (kindModifiers.deprecated) {
                    completionItem.tags = [CompletionItemTag.Deprecated];
                }
                if (kindModifiers.color) {
                    completionItem.kind = CompletionItemKind.Color;
                }
            }
            // console.log("entry item", entry);
            // console.log("completon item", completionItem);
            return completionItem;
        });
        // console.log("items", items.map(item => item.label));
        return CompletionList.create(items, items.length <= 0);

    }

    validate(document: MahalDoc, cancellationToken?: CancellationToken) {
        const uri = document.uri;

        const fileFsPath = this.getFileName(uri)
        const program = this.langService.getProgram();
        const sourceFile = program?.getSourceFile(fileFsPath);
        if (!program || !sourceFile) {
            return [];
        }

        const region = this.getRegion(document);

        let rawScriptDiagnostics = [
            ...program.getSyntacticDiagnostics(sourceFile, cancellationToken),
            ...program.getSemanticDiagnostics(sourceFile, cancellationToken),
            ...this.langService.getSuggestionDiagnostics(fileFsPath)
        ];

        const compilerOptions = program.getCompilerOptions();
        if (compilerOptions.declaration || compilerOptions.composite) {
            rawScriptDiagnostics = [
                ...rawScriptDiagnostics,
                ...program.getDeclarationDiagnostics(sourceFile, cancellationToken)
            ];
        }

        return rawScriptDiagnostics.map(diag => {
            const tags: DiagnosticTag[] = [];

            if (diag.reportsUnnecessary) {
                tags.push(DiagnosticTag.Unnecessary);
            }
            if (diag.reportsDeprecated) {
                tags.push(DiagnosticTag.Deprecated);
            }

            // syntactic/semantic diagnostic always has start and length
            // so we can safely cast diag to TextSpan
            return <Diagnostic>{
                range: convertRange(document, diag as TextSpan, region.start),
                severity: fromTsDiagnosticCategoryToDiagnosticSeverity(diag.category),
                message: flattenDiagnosticMessageText(diag.messageText, '\n'),
                tags,
                code: diag.code,
                source: 'Mahal-language-tools'
            };
        });
    }

    getCodeAction(document: MahalDoc, range: Range, context: CodeActionContext) {
        const uri = document.uri;
        const fileFsPath = this.getFileName(uri);
        const region = this.getRegion(document);

        let start = document.offsetAt(range.start)
        let end = document.offsetAt(range.end);

        start = start - region.start;
        end = end - region.start;

        const fixableDiagnosticCodes = context.diagnostics.map(d => Number(d.code)).filter(c =>
            this.supportedCodeFixCodes.has(c)
        );
        let results: CodeAction[] = [];
        const textRange = { pos: start, end };

        if (fixableDiagnosticCodes.length > 0) {
            const codeFixes = this.langService.getCodeFixesAtPosition(
                fileFsPath, start, end,
                fixableDiagnosticCodes,
                this.formatOptions,
                this.preferences
            );

            codeFixes.forEach(fix => {
                results.push({
                    title: fix.description,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: context.diagnostics,
                    edit: {
                        changes: createUriMappingForEdits(fix.changes, this.langService)
                    }
                });
                if (fix.fixAllDescription && fix.fixId) {
                    results.push({
                        title: fix.fixAllDescription,
                        kind: CodeActionKind.QuickFix,
                        diagnostics: context.diagnostics,
                        data: {
                            uri,
                            languageId: this.id,
                            kind: CodeActionDataKind.CombinedCodeFix,
                            textRange,
                            fixId: fix.fixId,
                            position: range.start
                        } as CodeActionData
                    });
                }
            })
        }

        results = [
            ...results,
            ...getRefactorFix(this, uri, fileFsPath, textRange, context),
            ...getOrganizeImportFix(this, uri, textRange, context)
        ]

        return results;
    }

    getCodeActionResolve(doc: MahalDoc, action: CodeAction) {

        const formatSettings = this.formatOptions
        const preferences = this.preferences;

        const fileFsPath = this.getFileName(doc.uri);
        const data = action.data as CodeActionData;

        if (data.kind === CodeActionDataKind.CombinedCodeFix) {
            const combinedFix = this.langService.getCombinedCodeFix(
                { type: 'file', fileName: fileFsPath },
                data.fixId,
                formatSettings,
                preferences
            );

            action.edit = { changes: createUriMappingForEdits(combinedFix.changes.slice(), this.langService) };
        }
        if (data.kind === CodeActionDataKind.RefactorAction) {
            const refactor = this.langService.getEditsForRefactor(
                fileFsPath,
                formatSettings,
                data.textRange,
                data.refactorName,
                data.actionName,
                preferences
            );
            if (refactor) {
                action.edit = { changes: createUriMappingForEdits(refactor.edits, this.langService) };
            }
        }
        if (data.kind === CodeActionDataKind.OrganizeImports) {
            const response = this.langService.organizeImports({ type: 'file', fileName: fileFsPath }, formatSettings, preferences);
            action.edit = { changes: createUriMappingForEdits(response.slice(), this.langService) };
        }

        delete action.data;
        return action;
    }

    doHover(document: MahalDoc, position: Position) {
        const uri = document.uri;
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start;
        const info = this.langService.getQuickInfoAtPosition(
            this.getFileName(uri), offset
        )
        if (info) {
            let hoverMdDoc = '';
            const doc = Previewer.plain(
                displayPartsToString(info.documentation));
            if (doc) {
                hoverMdDoc += doc + '\n\n';
            }

            if (info.tags) {
                info.tags.forEach(x => {
                    const tagDoc = Previewer.getTagDocumentation(x);
                    if (tagDoc) {
                        hoverMdDoc += tagDoc + '\n\n';
                    }
                });
            }
            let markedContents: MarkupContent;
            if (hoverMdDoc.trim() !== '') {
                markedContents = {
                    kind: MarkupKind.Markdown,
                    value: hoverMdDoc
                } as MarkupContent;
            }
            else {
                markedContents = {
                    kind: MarkupKind.PlainText,
                    value: displayPartsToString(info.displayParts)
                } as MarkupContent;
            }

            return {
                contents: markedContents,
                range: convertRange(
                    document.textDoc,
                    info.textSpan,
                    region.start
                ),
            } as Hover;
        }
        return null;
    }

    doResolve(item: CompletionItem) {
        const uri = item.data.uri;
        const details = this.langService.getCompletionEntryDetails(
            this.getFileName(uri),
            item.data.offset,
            item.data.entryName, undefined,
            item.data.source, undefined,
            item.data.tsData
        );
        if (details) {
            item.documentation = displayPartsToString(
                details.documentation);
            item.detail = displayPartsToString(details.displayParts);
            if (
                // this.supportsCompletionWithSnippets &&
                (details.kind === 'method' || details.kind === 'function')
            ) {
                const parameters = details.displayParts
                    .filter(p => p.kind === 'parameterName')
                    // tslint:disable-next-line:no-invalid-template-strings
                    .map((p, i) => '${' + `${i + 1}:${p.text}` + '}')
                const paramString = parameters.join(', ')
                item.insertText = details.name + `(${paramString})`
                item.insertTextFormat = InsertTextFormat.Snippet
            } else {
                item.insertTextFormat = InsertTextFormat.PlainText
                item.insertText = details.name
            }
            item.data = undefined
        }
        return item;
    }

    getReferences(document: MahalDoc, position: Position): Location[] {
        const uri = document.uri;
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start;
        const references = this.langService.getReferencesAtPosition(
            this.getFileName(uri),
            offset
        );
        if (!references) {
            return [];
        }
        const referenceResults: Location[] = [];
        const program = this.langService.getProgram();
        if (!program) {
            return [];
        }

        references.forEach(r => {
            const referenceTargetDoc = getSourceDoc(r.fileName, program);
            if (referenceTargetDoc) {
                referenceResults.push({
                    uri: uri,
                    range: convertRange(
                        document.textDoc, r.textSpan,
                        region.start
                    )
                });
            }
        });
        return referenceResults;
    }
    getSignatureHelp(document: MahalDoc, position: Position): SignatureHelp | null {
        const uri = document.uri;
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start
        const signatureHelpItems = this.langService.getSignatureHelpItems(
            this.getFileName(uri), offset, {}
        );
        if (!signatureHelpItems) {
            return null;
        }

        const signatures: SignatureInformation[] = [];
        signatureHelpItems.items.forEach(item => {
            let sigLabel = '';
            let sigMdDoc = '';
            const sigParamemterInfos: ParameterInformation[] = [];

            sigLabel += displayPartsToString(item.prefixDisplayParts);
            item.parameters.forEach((p, i, a) => {
                const label = displayPartsToString(p.displayParts);
                const parameter: ParameterInformation = {
                    label,
                    documentation: displayPartsToString(p.documentation)
                };
                sigLabel += label;
                sigParamemterInfos.push(parameter);
                if (i < a.length - 1) {
                    sigLabel += displayPartsToString(item.separatorDisplayParts);
                }
            });
            sigLabel += displayPartsToString(item.suffixDisplayParts);

            item.tags
                .filter(x => x.name !== 'param')
                .forEach(x => {
                    const tagDoc = Previewer.getTagDocumentation(x);
                    if (tagDoc) {
                        sigMdDoc += tagDoc + '\n\n';
                    }
                });

            signatures.push({
                label: sigLabel,
                documentation: {
                    kind: 'markdown',
                    value: sigMdDoc
                },
                parameters: sigParamemterInfos
            });
        });

        return {
            activeSignature: signatureHelpItems.selectedItemIndex,
            activeParameter: signatureHelpItems.argumentIndex,
            signatures
        } as SignatureHelp;
    }
    getDocumentSymbolsForHTML(document: MahalDoc) {
        if (this.symbolsCacheForHTML.length > 0) {
            return this.symbolsCacheForHTML;
        }
        const uri = document.uri;
        const region = this.getRegion(document);

        const items = this.langService.getNavigationBarItems(
            this.getFileName(uri)
        );

        // console.log("getDocumentSymbols region", region);

        // console.log("getDocumentSymbols items", items);
        if (!items) {
            return [];
        }

        const result: SymbolInformation[] = [];
        const existing: { [k: string]: boolean } = {};
        const isProp = (kind: string) => {
            switch (kind) {
                case 'var':
                case 'local var':
                case 'const':
                case 'function':
                case 'local function':
                // case 'enum':
                //     return SymbolKind.Enum;
                // case 'module':
                //     return SymbolKind.Module;
                // case 'class':
                //     return SymbolKind.Class;
                // case 'interface':
                //     return SymbolKind.Interface;
                case 'function':
                case 'local function':
                case 'method':
                // case 'constructor':
                //     return SymbolKind.Constructor;
                case 'property':
                case 'getter':
                case 'setter':
                    return true;
            }
            return false;
        }
        const collectSymbols = (item: NavigationBarItem, containerLabel?: string) => {

            // console.log("collectSymbols items", item);
            const sig = item.text + item.kind + item.spans[0].start;
            if (item.kind !== 'script' && !existing[sig]) {
                const symbol: SymbolInformation = {
                    name: item.text,
                    kind: toSymbolKind(item.kind),
                    location: {
                        uri: uri,
                        range: convertRange(
                            document.textDoc,
                            item.spans[0],
                            region.start
                        )
                    },
                    containerName: containerLabel
                };
                existing[sig] = true;
                if (isProp(item.kind)) {
                    result.push(symbol);
                }
                containerLabel = item.text;
            }

            for (const child of item.childItems || []) {
                collectSymbols(child, containerLabel);
            }
        };

        items.forEach(item => collectSymbols(item));
        // console.log("getDocumentSymbols", result);
        this.symbolsCacheForHTML = result;
        return result;
    }
    getDocumentSymbols(document: MahalDoc) {
        const uri = document.uri;
        const region = this.getRegion(document);

        const items = this.langService.getNavigationBarItems(
            this.getFileName(uri)
        );

        // console.log("getDocumentSymbols region", region);

        // console.log("getDocumentSymbols items", items);
        if (!items) {
            return [];
        }

        const result: SymbolInformation[] = [];
        const existing: { [k: string]: boolean } = {};
        const collectSymbols = (item: NavigationBarItem, containerLabel?: string) => {
            // console.log("collectSymbols items", item);
            const sig = item.text + item.kind + item.spans[0].start;
            if (item.kind !== 'script' && !existing[sig]) {
                const symbol: SymbolInformation = {
                    name: item.text,
                    kind: toSymbolKind(item.kind),
                    location: {
                        uri: uri,
                        range: convertRange(
                            document.textDoc,
                            item.spans[0],
                            region.start
                        )
                    },
                    containerName: containerLabel
                };
                existing[sig] = true;
                result.push(symbol);
                containerLabel = item.text;
            }

            for (const child of item.childItems || []) {
                collectSymbols(child, containerLabel);
            }
        };

        items.forEach(item => collectSymbols(item));
        // console.log("getDocumentSymbols", result);
        return result;
    }
    getDocumentHighlight(document: MahalDoc, position: Position): DocumentHighlight[] {

        const uri = document.uri;
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start;

        const occurrences = this.langService.getReferencesAtPosition(
            this.getFileName(uri), offset
        );
        if (!occurrences) {
            return []
        }

        const occurrencess = occurrences.map(entry => {
            return {
                range: convertRange(
                    document.textDoc, entry.textSpan, region.start
                ),
                kind: entry.isWriteAccess ? DocumentHighlightKind.Write : DocumentHighlightKind.Text
            };
        });

        // console.log("occurrencess", occurrencess);
        return occurrencess;
    }

    getSemanticTokens(document: MahalDoc) {
        const uri = document.uri;
        const { doc } = this.getDoc(document);
        const region = this.getRegion(document);
        // const start = document.offsetAt(range.start) - region.start;
        // const end = document.offsetAt(range.end) - region.start;
        // const offset = document.offsetAt(range.start) - region.start;

        const scriptText = doc.getText();
        if (scriptText.length > SEMANTIC_TOKEN_CONTENT_LENGTH_LIMIT) {
            return [];
        }
        const fileFsPath = this.getFileName(uri);
        // range
        //     ? {
        //         start: start,
        //         length: end - start
        //     } as TextSpan
        //     : 
        // console.log('getSemanticTokens', scriptText);
        const textSpan = {
            start: 0,
            length: scriptText.length
        };
        const { spans } = this.langService.getEncodedSemanticClassifications(
            fileFsPath,
            textSpan,
            SemanticClassificationFormat.TwentyTwenty
        );

        // console.log("spans", spans, spans.length);

        const data: ISemanticTokenOffsetData[] = [];
        let index = 0;

        while (index < spans.length) {
            // [start, length, encodedClassification, start2, length2, encodedClassification2]
            const start = spans[index++];
            const length = spans[index++];
            const encodedClassification = spans[index++];
            const classificationType = getTokenTypeFromClassification(encodedClassification);
            if (classificationType < 0) {
                continue;
            }

            const modifierSet = getTokenModifierFromClassification(encodedClassification);

            data.push({
                start,
                length,
                classificationType,
                modifierSet
            });
        }

        // const program = this.langService.getProgram();
        // if (program) {
        //     const refTokens = addCompositionApiRefTokens(program, fileFsPath, data, this.refTokensService);
        //     this.refTokensService.send(
        //         uri,
        //         refTokens.map(t => Range.create(
        //             document.positionAt(t[0] + region.start),
        //             document.positionAt(t[1] + region.start))
        //         )
        //     );
        // }

        return data.map(({ start, ...rest }) => {
            const startPosition = document.positionAt(start + region.start);

            return {
                ...rest,
                line: startPosition.line,
                character: startPosition.character
            };
        });
    }

    getDefinition(document: MahalDoc, position: Position): Definition {
        const uri = document.uri;
        const fileFsPath = this.getFileName(uri);
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start;
        const definitions = this.langService.getDefinitionAtPosition(
            fileFsPath, offset
        );
        if (!definitions) {
            return [];
        }

        const definitionResults: Definition = [];
        const program = this.langService.getProgram();
        if (!program) {
            return [];
        }
        definitions.forEach(d => {
            const definitionTargetDoc = getSourceDoc(
                d.fileName,
                program
            );
            definitionResults.push({
                uri: getURLFromPath(d.fileName),
                range: convertRange(
                    definitionTargetDoc,
                    d.textSpan,
                    isMahalFile(d.fileName) ? region.start : 0
                )
            });
        });
        return definitionResults;
    }

    format(doc: MahalDoc, formatParams: FormattingOptions) {
        const editorConfig = this.docManager.editorConfig;
        const format = this.docManager.editorConfig.script.format;
        if (!format.enable) {
            return [];
        }

        const uri = doc.uri;
        const fileFsPath = this.getFileName(uri);
        const region = this.getRegion(doc);
        return this.langService.getFormattingEditsForRange(
            fileFsPath,
            region.start,
            region.end,
            {
                TabSize: editorConfig.tabSize,//editorConfig.tabSize,
                ConvertTabsToSpaces: format.convertTabsToSpaces,
                insertSpaceAfterCommaDelimiter: format.insertSpaceAfterCommaDelimiter,
                insertSpaceAfterConstructor: format.insertSpaceAfterConstructor,
                insertSpaceAfterFunctionKeywordForAnonymousFunctions: format.insertSpaceAfterFunctionKeywordForAnonymousFunctions,
                InsertSpaceAfterKeywordsInControlFlowStatements: format.insertSpaceAfterKeywordsInControlFlowStatements,
                insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: format.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces,
                insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces,
                InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: format.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets,
                InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: format.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis,
                InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: format.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces,
                insertSpaceAfterSemicolonInForStatements: format.insertSpaceAfterSemicolonInForStatements,
                insertSpaceBeforeAndAfterBinaryOperators: format.insertSpaceBeforeAndAfterBinaryOperators,
                IndentSize: editorConfig.indentSize,
                IndentStyle: editorConfig.indentStyle
            }
        ).map(item => {
            return {
                newText: item.newText,
                range: convertRange(doc.textDoc, item.span, region.start),
            } as TextEdit
        })
    }
}

function createUriMappingForEdits(changes: FileTextChanges[], service: LanguageService) {
    const program = service.getProgram()!;
    const result: Record<string, TextEdit[]> = {};
    for (const { fileName, textChanges } of changes) {
        const targetDoc = getSourceDoc(fileName, program);
        const edits = textChanges.map(({ newText, span }) => ({
            newText,
            range: convertRange(targetDoc, span)
        }));
        const uri = getURLFromPath(fileName);
        if (result[uri]) {
            result[uri].push(...edits);
        } else {
            result[uri] = edits;
        }
    }
    return result;
}

function walk(node: Node, callback: (node: Node) => void) {
    node.forEachChild(child => {
        callback(child);
        walk(child, callback);
    });
}

export function getTokenModifierFromClassification(tsClassification: number) {
    return tsClassification & TokenEncodingConsts.modifierMask;
}

export function getTokenTypeFromClassification(tsClassification: number): number {
    return (tsClassification >> TokenEncodingConsts.typeOffset) - 1;
}


function toTextSpan(range: Range, doc: TextDocument): TextSpan {
    const start = doc.offsetAt(range.start);
    const end = doc.offsetAt(range.end);

    return {
        start,
        length: end - start
    };
}


function getSourceDoc(fileName: string, program: Program): TextDocument {
    const sourceFile = program.getSourceFile(fileName)!;
    return TextDocument.create(fileName, 'mahal', 0, sourceFile.getFullText());
}

function convertRange(document: TextDocument | MahalDoc, span: TextSpan, relativeStart = 0): Range {
    const start = span.start + relativeStart;
    const startPosition = document.positionAt(start);
    const endPosition = document.positionAt(start + span.length);
    return Range.create(startPosition, endPosition);
}


function parseKindModifier(kindModifiers: string) {
    const kinds = new Set(kindModifiers.split(/,|\s+/g));

    return {
        optional: kinds.has('optional'),
        deprecated: kinds.has('deprecated'),
        color: kinds.has('color')
    };
}

function getLabelAndDetailFromCompletionEntry(entry: CompletionEntry) {
    // Is import path completion
    if (entry.kind === ScriptElementKind.scriptElement) {
        if (entry.kindModifiers) {
            return {
                label: entry.name,
                detail: entry.name + entry.kindModifiers
            };
        } else {
            const ext = ".mahal";
            if (entry.name.endsWith(ext)) {
                return {
                    label: entry.name.slice(0, -ext.length),
                    detail: entry.name
                };
            }
        }
    }

    return {
        label: entry.name,
        detail: undefined
    };
}

/* tslint:disable:max-line-length */
/**
 * Adapted from https://github.com/microsoft/vscode/blob/2b090abd0fdab7b21a3eb74be13993ad61897f84/extensions/typescript-language-features/src/languageFeatures/completions.ts#L147-L181
 */
function getFilterText(insertText: string | undefined): string | undefined {
    // For `this.` completions, generally don't set the filter text since we don't want them to be overly prioritized. #74164
    if (insertText?.startsWith('this.')) {
        return undefined;
    }

    // Handle the case:
    // ```
    // const xyz = { 'ab c': 1 };
    // xyz.ab|
    // ```
    // In which case we want to insert a bracket accessor but should use `.abc` as the filter text instead of
    // the bracketed insert text.
    else if (insertText?.startsWith('[')) {
        return insertText.replace(/^\[['"](.+)[['"]\]$/, '.$1');
    }

    // In all other cases, fallback to using the insertText
    return insertText;
}

export function toCompletionItemKind(kind: ScriptElementKind): CompletionItemKind {
    switch (kind) {
        case 'primitive type':
        case 'keyword':
            return CompletionItemKind.Keyword;
        case 'var':
        case 'local var':
            return CompletionItemKind.Variable;
        case 'property':
        case 'getter':
        case 'setter':
            return CompletionItemKind.Field;
        case 'function':
        case 'method':
        case 'construct':
        case 'call':
        case 'index':
            return CompletionItemKind.Function;
        case 'enum':
            return CompletionItemKind.Enum;
        case 'module':
            return CompletionItemKind.Module;
        case 'class':
            return CompletionItemKind.Class;
        case 'interface':
            return CompletionItemKind.Interface;
        case 'warning':
            return CompletionItemKind.File;
        case 'script':
            return CompletionItemKind.File;
        case 'directory':
            return CompletionItemKind.Folder;
    }

    return CompletionItemKind.Property;
}
const NON_SCRIPT_TRIGGERS = ['<', '*', ':'];

function getTsTriggerCharacter(triggerChar: string) {
    const legalChars = ['@', '#', '.', '"', "'", '`', '/', '<'];
    if (legalChars.includes(triggerChar)) {
        return triggerChar as CompletionsTriggerCharacter;
    }
    return undefined;
}

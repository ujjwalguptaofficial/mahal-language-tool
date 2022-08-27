import { displayPartsToString, LanguageService, NavigationBarItem, Program, ScriptElementKind, SemanticClassificationFormat, TextSpan, SymbolFlags, isIdentifier, isPropertyAccessExpression, IndentStyle, CancellationToken, flattenDiagnosticMessageText, getSupportedCodeFixes, FileTextChanges, UserPreferences, FormatCodeSettings, DefinitionInfo, QuickInfo } from "typescript";
import { CompletionItem, Range, CompletionItemKind, CompletionItemTag, CompletionList, Hover, InsertTextFormat, Location, MarkupContent, MarkupKind, Position, SignatureInformation, ParameterInformation, SignatureHelp, SymbolInformation, DocumentHighlightKind, DocumentHighlight, Definition, FormattingOptions, TextEdit, DiagnosticTag, Diagnostic, CodeActionContext, CodeAction, CodeActionKind } from "vscode-languageserver/node";
import * as Previewer from '../../utils/previewer';
import { fromTsDiagnosticCategoryToDiagnosticSeverity, getURLFromPath, isMahalFile, joinPath, toSymbolKind } from "../../utils";
import { NON_SCRIPT_TRIGGERS, SEMANTIC_TOKEN_CONTENT_LENGTH_LIMIT, TokenEncodingConsts, TokenModifier, TokenType } from "../../constants";
import { CodeActionData, CodeActionDataKind, EmbeddedRegion, ISemanticTokenOffsetData, RefactorActionData } from "../../interfaces";
import { MahalDoc } from "../../models";
import { LanguageId } from "../../types";
import { MahalLang } from "../../abstracts";
import { DocManager } from "../../managers";
import { getRefactorFix } from "./get_refactor_fix";
import { getOrganizeImportFix } from "./get_organize_import_fix";
import { convertRange } from "./convert_range";
import { getSourceDoc } from "./get_source-doc";
import { createUriMappingForEdits } from "./create_uri_mapping_for_edits";
import { parseKindModifier } from "./parse_kind_modifier";
import { toCompletionItemKind } from "./to_completion_item_kind";
import { getFilterText } from "./get_filter_text";
import { getLabelAndDetailFromCompletionEntry } from "./get_label_and_detail_from_completion_entry";
import { getTsTriggerCharacter } from "./get_ts_trigger_character";
import { format } from "prettier";
import { pathToFileURL } from "url";
import { TypeScriptService } from "../../services/index";
import { parse } from "yaml";

export class JsLang extends MahalLang {
    readonly id: LanguageId = 'javascript';

    symbolsCacheForHTML: SymbolInformation[] = [];

    supportedCodeFixCodes: Set<number>;

    preferences: UserPreferences = {
        includeCompletionsForImportStatements: true,
        includePackageJsonAutoImports: "on"
    };

    formatOptions: FormatCodeSettings;

    langService: LanguageService;

    constructor(
        public service: TypeScriptService,
        docManager: DocManager,
    ) {
        super(docManager);
        this.langService = service.getLangService();

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

    doComplete(document: MahalDoc, position: Position, region: EmbeddedRegion) {
        this.symbolsCacheForHTML = [];
        const uri = document.uri;
        const offset = document.offsetAt(position) - region.start;
        const doc = this.getRegionDoc(document, region);
        const fileText = doc.getText();

        // console.log("saved fileText", fileText.split(""), fileText.length, `'${fileText}'`);

        const triggerChar = fileText[offset - 1];
        if (NON_SCRIPT_TRIGGERS.includes(triggerChar)) {
            return CompletionList.create([], false)
        }
        // console.log("triggerChar", triggerChar);
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
        // items.push({
        //     label: "import modules",
        //     detail: "import modules",
        //     insertText: 'import {} from "${0}"',
        //     insertTextFormat: InsertTextFormat.Snippet
        // })
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
            ...document.scriptLanguage === 'ts' ?
                program.getSemanticDiagnostics(sourceFile, cancellationToken) : [],
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
        try {
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
                            changes: createUriMappingForEdits(
                                fix.changes,
                                this,
                                region.start
                            )
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
                                position: range.start,
                                region: region
                            } as CodeActionData
                        });
                    }
                })
            }
            results = [
                ...results,
                ...getRefactorFix(this, uri, fileFsPath, textRange, context, region, range.start),
                ...getOrganizeImportFix(this, uri, textRange, context, region, range.start)
            ]
        } catch (error) {

        }

        return results;
    }

    getCodeActionResolve(doc: MahalDoc, action: CodeAction) {
        const formatSettings = this.formatOptions
        const preferences = this.preferences;

        const fileFsPath = this.getFileName(doc.uri);
        const data = action.data as CodeActionData;
        const region = data.region;

        if (data.kind === CodeActionDataKind.CombinedCodeFix) {
            const combinedFix = this.langService.getCombinedCodeFix(
                { type: 'file', fileName: fileFsPath },
                data.fixId,
                formatSettings,
                preferences
            );

            action.edit = {
                changes: createUriMappingForEdits(
                    combinedFix.changes.slice(),
                    this,
                    region.start
                )
            };
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
                action.edit = {
                    changes: createUriMappingForEdits(refactor.edits, this, region.start)
                };
            }
        }
        if (data.kind === CodeActionDataKind.OrganizeImports) {
            const response = this.langService.organizeImports({ type: 'file', fileName: fileFsPath }, formatSettings, preferences);
            action.edit = {
                changes: createUriMappingForEdits(response.slice(), this, region.start)
            };
        }

        delete action.data;
        return action;
    }

    private addDocInDefinition(definitions: readonly DefinitionInfo[], info: QuickInfo) {
        const mahalDefinition = definitions.find(item => {
            return isMahalFile(item.fileName)
        });
        if (mahalDefinition) {
            // console.log('mahalDefinition filename', mahalDefinition.fileName)
            // console.log('filename', mahalDefinition.fileName,
            //     // pathToFileURL(mahalDefinition.fileName).pathname
            //     joinPath(this.service.workSpaceDirAsURI, mahalDefinition.fileName)
            // );
            // const importFilePath = joinPath(this.service.workSpaceDirAsURI, mahalDefinition.fileName)

            const mahalFile = this.docManager.getByPath(mahalDefinition.fileName);
            // console.log('mahalfile', mahalFile);
            // console.log('keys', Array.from(this.docManager.docs.keys()));
            if (mahalFile) {
                const ymlRegion = this.getRegions(mahalFile, 'yml')[0];
                if (ymlRegion) {
                    const ymlDoc = this.getRegionDoc(
                        mahalFile, ymlRegion
                    );
                    try {
                        const parsedYmlDoc = parse(ymlDoc.getText());
                        if (!parsedYmlDoc) return;
                        const desc = parsedYmlDoc.description;
                        // console.log('parseResult',parseResult)
                        if (desc) {
                            const indexOfDoc = info.documentation.findIndex(q => q.text === desc)
                            if (indexOfDoc < 0) {
                                info.documentation.push({
                                    text: desc,
                                    kind: MarkupKind.Markdown
                                })
                            };
                            delete parsedYmlDoc.desc;
                            const tags = info.tags || [];
                            for (const docKey in parsedYmlDoc) {
                                const docValue = parsedYmlDoc[docKey] || '';
                                tags.push({
                                    name: docKey,
                                    text: (() => {
                                        if (typeof docValue === 'object') {
                                            let text = '\n'
                                            for (const key in docValue) {
                                                text += `**${key}** : ${docValue[key]} \n\n`;
                                            }
                                            return text;
                                        }
                                        return docValue;
                                    })()
                                })
                            }
                            info.tags = tags;
                            // (definitions as any)[0] = info
                            // Object.assign(info, info);
                        }

                    } catch (error) {
                        console.error('error in parsing yaml', error);
                    }
                }
            }

        }
    }

    doHover(document: MahalDoc, position: Position) {
        const uri = document.uri;
        const region = this.getRegion(document);
        const offset = document.offsetAt(position) - region.start;
        const fileName = this.getFileName(uri);

        const info = this.langService.getQuickInfoAtPosition(
            fileName, offset
        )
        if (!info) return null;
        // console.log('info', info);
        if (info.kindModifiers === 'export') {
            const definitions = this.langService.getDefinitionAtPosition(
                fileName, offset
            );
            // console.log("fileNameS", Array.from(this.docManager.docs.keys()));
            this.addDocInDefinition(definitions, info);
        }
        //   this.getFile  

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

        if (!region) {
            return [];
        }

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

        if (!region) {
            return [];
        }

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
        const region = this.getRegion(document);
        const doc = this.getRegionDoc(document, region);
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
                uri: pathToFileURL(d.fileName).toString(),
                range: convertRange(
                    definitionTargetDoc,
                    d.textSpan,
                    isMahalFile(d.fileName) ? region.start : 0
                )
            });
        });
        return definitionResults;
    }

    format(document: MahalDoc, formatParams: FormattingOptions) {
        const editorConfig = this.docManager.editorConfig;
        const formatConfig = this.docManager.editorConfig.script.format;
        if (!formatConfig.enable) {
            return [];
        }

        const uri = document.uri;
        const fileFsPath = this.getFileName(uri);
        const region = this.getRegion(document);
        const doc = this.getRegionDoc(document, region);
        const regionText = doc.getText();
        const formattedString = format(regionText, {
            parser: "typescript",
            tabWidth: editorConfig.tabSize,
        });
        const range = {
            start: document.positionAt(region.start + (regionText[0] === '\r' ? 2 : 1)),
            // end: document.positionAt(region.end - 1)
            end: document.positionAt(region.end)
        }
        return [TextEdit.replace(range, formattedString)];
        // return this.langService.getFormattingEditsForRange(
        //     fileFsPath,
        //     region.start,
        //     region.end,
        //     {
        //         TabSize: editorConfig.tabSize,//editorConfig.tabSize,
        //         ConvertTabsToSpaces: formatConfig.convertTabsToSpaces,
        //         insertSpaceAfterCommaDelimiter: formatConfig.insertSpaceAfterCommaDelimiter,
        //         insertSpaceAfterConstructor: formatConfig.insertSpaceAfterConstructor,
        //         insertSpaceAfterFunctionKeywordForAnonymousFunctions: formatConfig.insertSpaceAfterFunctionKeywordForAnonymousFunctions,
        //         InsertSpaceAfterKeywordsInControlFlowStatements: formatConfig.insertSpaceAfterKeywordsInControlFlowStatements,
        //         insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: formatConfig.insertSpaceAfterOpeningAndBeforeClosingEmptyBraces,
        //         insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: formatConfig.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces,
        //         InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: formatConfig.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets,
        //         InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: formatConfig.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis,
        //         InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: formatConfig.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces,
        //         insertSpaceAfterSemicolonInForStatements: formatConfig.insertSpaceAfterSemicolonInForStatements,
        //         insertSpaceBeforeAndAfterBinaryOperators: formatConfig.insertSpaceBeforeAndAfterBinaryOperators,
        //         IndentSize: editorConfig.indentSize,
        //         IndentStyle: editorConfig.indentStyle
        //     }
        // ).map(item => {
        //     return {
        //         newText: item.newText,
        //         range: convertRange(document.textDoc, item.span, region.start),
        //     } as TextEdit
        // })
    }
}


export function getTokenModifierFromClassification(tsClassification: number) {
    return tsClassification & TokenEncodingConsts.modifierMask;
}

export function getTokenTypeFromClassification(tsClassification: number): number {
    return (tsClassification >> TokenEncodingConsts.typeOffset) - 1;
}





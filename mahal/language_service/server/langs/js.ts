import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { CompletionEntry, Node, CompletionsTriggerCharacter, createScanner, displayPartsToString, LanguageService, NavigationBarItem, Program, ScriptElementKind, SemanticClassificationFormat, TextSpan, SymbolFlags, isIdentifier, isPropertyAccessExpression, IndentStyle } from "typescript";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, Range, CompletionItemKind, CompletionItemTag, CompletionList, Hover, InsertTextFormat, Location, MarkupContent, MarkupKind, Position, SignatureInformation, ParameterInformation, SignatureHelp, SymbolInformation, DocumentHighlightKind, DocumentHighlight, Definition, FormattingOptions, TextEdit } from "vscode-languageserver/node";
import * as Previewer from '../utils/previewer';
import { getFilePathFromURL, getURLFromPath, isMahalFile, toSymbolKind } from "../utils";
import { SEMANTIC_TOKEN_CONTENT_LENGTH_LIMIT, TokenEncodingConsts, TokenModifier, TokenType } from "../constants";
import { ISemanticTokenOffsetData } from "../interfaces";
import { RefTokensService } from "../services";
import { MahalDoc } from "../models";

export class JsLang extends MahalLang {
    readonly id = 'javascript';

    constructor(
        private langService: LanguageService,
        docManager: DocManager,
        private refTokensService: RefTokensService
    ) {
        super(docManager);
    }

    doComplete(document: MahalDoc, position: Position) {
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

            if (item.childItems && item.childItems.length > 0) {
                for (const child of item.childItems) {
                    collectSymbols(child, containerLabel);
                }
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
        // const start = document.offsetAt(range.start) - region.start;
        // const end = document.offsetAt(range.end) - region.start;
        // const offset = document.offsetAt(range.start) - region.start;

        const scriptText = document.getText();
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

        const program = this.langService.getProgram();
        if (program) {
            const refTokens = addCompositionApiRefTokens(program, fileFsPath, data, this.refTokensService);
            this.refTokensService.send(
                uri,
                refTokens.map(t => Range.create(
                    document.positionAt(t[0] + region.start),
                    document.positionAt(t[1] + region.start))
                )
            );
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

function walk(node: Node, callback: (node: Node) => void) {
    node.forEachChild(child => {
        callback(child);
        walk(child, callback);
    });
}

export function addCompositionApiRefTokens(
    program: Program,
    fileFsPath: string,
    exists: ISemanticTokenOffsetData[],
    refTokensService: RefTokensService
): [number, number][] {
    const sourceFile = program.getSourceFile(fileFsPath);

    if (!sourceFile) {
        return [];
    }

    const typeChecker = program.getTypeChecker();

    const tokens: [number, number][] = [];
    walk(sourceFile, node => {
        if (!isIdentifier(node) || node.text !== 'value' || !isPropertyAccessExpression(node.parent)) {
            return;
        }
        const propertyAccess = node.parent;

        let parentSymbol = typeChecker.getTypeAtLocation(propertyAccess.expression).symbol;

        if (parentSymbol.flags & SymbolFlags.Alias) {
            parentSymbol = typeChecker.getAliasedSymbol(parentSymbol);
        }

        if (parentSymbol.name !== 'Ref') {
            return;
        }

        const start = node.getStart();
        const length = node.getWidth();
        tokens.push([start, start + length]);
        const exist = exists.find(token => token.start === start && token.length === length);
        const encodedModifier = 1 << TokenModifier.refValue;

        if (exist) {
            exist.modifierSet |= encodedModifier;
        } else {
            exists.push({
                classificationType: TokenType.property,
                length: node.getEnd() - node.getStart(),
                modifierSet: encodedModifier,
                start: node.getStart()
            });
        }
    });

    return tokens;
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

function convertRange(document: TextDocument, span: TextSpan, relativeStart = 0): Range {
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

import { MahalLang } from "../abstracts";
import { DocManager } from "../managers";
import { CompletionEntry, CompletionsTriggerCharacter, createScanner, displayPartsToString, LanguageService, ScriptElementKind } from "typescript";
import { TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem, CompletionItemKind, CompletionItemTag, CompletionList, InsertTextFormat, Position } from "vscode-languageserver/node";

export class JsLang extends MahalLang {
    readonly id = 'javascript';

    constructor(
        private langService: LanguageService,
        docManager: DocManager
    ) {
        super(docManager);
    }

    doComplete(document: TextDocument, position: Position) {
        const uri = document.uri;
        const savedDoc = this.getDoc(document);

        const offset = savedDoc.offsetAt(position);
        const fileText = savedDoc.getText();

        // console.log("saved fileText", fileText.split(""), fileText.length, `'${fileText}'`);

        const triggerChar = fileText[offset - 1];
        if (NON_SCRIPT_TRIGGERS.includes(triggerChar)) {
            console.log("returning empty");
            return Promise.resolve(
                CompletionList.create([], false)
            )
        }
        const triggerCharValue = getTsTriggerCharacter(triggerChar);
        console.log("offset", offset);

        const result = this.langService.getCompletionsAtPosition(
            uri + ".ts", offset,
            {
                allowIncompleteCompletions: true,
                allowTextChangesInNewFiles: true,
                includeAutomaticOptionalChainCompletions: true,
                includeCompletionsWithInsertText: true,
                triggerCharacter: triggerCharValue,
                includeCompletionsForImportStatements: true,
                includeCompletionsForModuleExports: true,
                includeCompletionsWithSnippetText: true,
                includePackageJsonAutoImports: "auto"
            }
        )

        const entries = result ? result.entries : [];
        console.log("entries", entries.length);
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
        return Promise.resolve(
            CompletionList.create(items, false)
        );
    }

    doHover(document: TextDocument, position: Position) {
        return null;

        // const doc = this.getDoc(document);

        // return this.langService.(
        //     doc,
        //     position,
        //     this.langService.parseHTMLDocument(doc)
        // )
    }

    doResolve(item: CompletionItem) {
        console.log("item", item.data);
        const details = this.langService.getCompletionEntryDetails(
            item.data.uri + ".ts",
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

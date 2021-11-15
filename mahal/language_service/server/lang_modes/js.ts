import { CompletionEntry, CompletionsTriggerCharacter, LanguageService, ScriptElementKind, sys } from 'typescript';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
import { basename } from "path";
import { fileURLToPath } from 'url';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver-types';
import { getContentFromXmlNode, getRangeFromXmlNode } from '../helpers';

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

export function getJSMode(
    tsLanguageService: LanguageService,
    documentRegions: ILanguageCache<IMahalDocumentRegion>
): ILanguageMode {
    return {
        getId() {
            return 'javascript';
        },
        // doValidation(document: TextDocument) {
        //     const embedded = documentRegions.get(document).getEmbeddedDocument('javascript');
        //     return tsLanguageService.val(embedded.uri, {});
        // },
        doComplete(document: TextDocument, position: Position) {
            const embedded = documentRegions.get(document).getEmbeddedDocument('javascript');
            const fileName = fileURLToPath(embedded.uri) + ".ts";

            const jsTextDoc = TextDocument.create(
                embedded.uri, 'mahal', document.version,
                getContentFromXmlNode(document.getText(), 'script')
            )

            console.log("document.getText()", document.getText())

            console.log("js do Complete called", fileName);
            try {
                // console.log("filexist", sys.fileExists(fileName))
                // const prog = tsLanguageService.getProgram();
                // const source = prog.getSourceFile(fileName);
                // console.log("source", source);

                const offset = jsTextDoc.offsetAt(position);
                const fileText = jsTextDoc.getText();
                console.log("fileText", `start ${fileText} end`)
                console.log("offset", offset, "char", `"${fileText[offset]}"`,
                    `"${fileText[offset - 1]}"`
                );
                const triggerChar = fileText[offset - 1];
                if (NON_SCRIPT_TRIGGERS.includes(triggerChar)) {
                    return { isIncomplete: false, items: [] };
                }
                const triggerCharValue = getTsTriggerCharacter(triggerChar);
                console.log("triggerCharValue", triggerCharValue);
                const result = tsLanguageService.getCompletionsAtPosition(
                    fileName, offset,
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
                );
                const entries = result ? result.entries : [];
                // console.log("result", result);
                return entries.map(item => {
                    const { detail, label } = getLabelAndDetailFromCompletionEntry(item);
                    const completionItem: CompletionItem = {

                        label: label,
                        detail: detail,
                        sortText: item.sortText,
                        insertText: item.insertText,
                        preselect: item.isRecommended,
                        filterText: getFilterText(item.insertText),
                        kind: toCompletionItemKind(item.kind),

                    };
                    return completionItem;
                }) as any
            } catch (error) {
                console.error("error", error);
            }

            return []
        },
        onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
        dispose() { /* nothing to do */ },
        
    };
}

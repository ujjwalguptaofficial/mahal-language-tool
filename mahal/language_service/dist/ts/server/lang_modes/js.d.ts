import { LanguageService, ScriptElementKind } from 'typescript';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
import { CompletionItemKind } from 'vscode-languageserver-types';
export declare function toCompletionItemKind(kind: ScriptElementKind): CompletionItemKind;
export declare function getJSMode(tsLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode;

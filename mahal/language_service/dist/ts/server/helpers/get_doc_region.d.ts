import { TextDocument } from "vscode-languageserver-textdocument";
import { LanguageService } from "vscode-html-languageservice";
import { ILanguageRange } from "../interfaces";
import { Position, Range } from "vscode-languageserver";
export interface HTMLDocumentRegions {
    getEmbeddedDocument(languageId: string, ignoreAttributeValues?: boolean): TextDocument;
    getLanguageRanges(range: Range): ILanguageRange[];
    getLanguageAtPosition(position: Position): string | undefined;
    getLanguagesInDocument(): string[];
    getImportedScripts(): string[];
}
export declare function getDocumentRegions(languageService: LanguageService, document: TextDocument): HTMLDocumentRegions;
export declare const CSS_STYLE_RULE = "__";

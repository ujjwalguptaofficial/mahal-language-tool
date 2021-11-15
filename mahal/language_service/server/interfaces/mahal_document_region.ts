import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { ILanguageRange } from "./language_range";
import { Range } from "vscode-languageserver";

export interface IMahalDocCache {
    getEmbeddedDocument(languageId: string, ignoreAttributeValues?: boolean): TextDocument;
    getLanguageRanges(range: Range): ILanguageRange[];
    getLanguageAtPosition(position: Position): string | undefined;
    getLanguagesInDocument(): string[];
    getImportedScripts(): string[];
}
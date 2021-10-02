import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Diagnostic, CompletionList } from "vscode-html-languageservice";
import { Range } from "vscode-languageserver";

export interface ILanguageMode {
	getId(): string;
	doValidation?: (document: TextDocument) => Diagnostic[];
	doComplete?: (document: TextDocument, position: Position) => CompletionList;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
	doTagComplete?(document: TextDocument, position: Position)
}

export interface ILanguageModes {
	getModeAtPosition(document: TextDocument, position: Position): ILanguageMode | undefined;
	getModesInRange(document: TextDocument, range: Range): ILanguageModeRange[];
	getAllModes(): ILanguageMode[];
	getAllModesInDocument(document: TextDocument): ILanguageMode[];
	getMode(languageId: string): ILanguageMode | undefined;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}

export interface ILanguageModeRange extends Range {
	mode: ILanguageMode | undefined;
	attributeValue?: boolean;
}
import { TextDocument } from "vscode-languageserver-textdocument";

export interface ILanguageCache<T> {
	get(document: TextDocument): T;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}
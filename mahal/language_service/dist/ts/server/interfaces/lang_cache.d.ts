import { TextDocument } from "vscode-languageserver-textdocument";
export interface ILangCache<T> {
    /**
     * - Feed updated document
     * - Use `parse` function to re-compute model
     * - Return re-computed model
     */
    refreshAndGet(document: TextDocument): T;
    onDocumentRemoved(document: TextDocument): void;
    dispose(): void;
}

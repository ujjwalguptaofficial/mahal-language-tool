import { LanguageService } from 'vscode-typescript-languageservice';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';

export function getJSMode(
    jsLanguageService: LanguageService,
    documentRegions: ILanguageCache<IMahalDocumentRegion>
): ILanguageMode {
    return {
        getId() {
            return 'javascript';
        },
        doValidation(document: TextDocument) {
            const embedded = documentRegions.get(document).getEmbeddedDocument('javascript');
            return jsLanguageService.doValidation(embedded.uri, {});
        },
        doComplete(document: TextDocument, position: Position) {
            const embedded = documentRegions.get(document).getEmbeddedDocument('javascript');
            return jsLanguageService.doComplete(embedded.uri, position) as any;
        },
        onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
        dispose() { /* nothing to do */ }
    };
}

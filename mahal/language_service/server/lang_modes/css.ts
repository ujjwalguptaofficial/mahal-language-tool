import { LanguageService as CSSLanguageService, Position } from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';

export function getCSSMode(
	cssLanguageService: CSSLanguageService,
	documentRegions: ILanguageCache<IMahalDocumentRegion>
): ILanguageMode {
	return {
		getId() {
			return 'css';
		},
		doValidation(document: TextDocument) {
			const embedded = documentRegions.get(document).getEmbeddedDocument('css');
			const stylesheet = cssLanguageService.parseStylesheet(embedded);
			return cssLanguageService.doValidation(embedded, stylesheet);
		},
		doComplete(document: TextDocument, position: Position) {
			const embedded = documentRegions.get(document).getEmbeddedDocument('css');
			const stylesheet = cssLanguageService.parseStylesheet(embedded);
			return cssLanguageService.doComplete(embedded, position, stylesheet);
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}

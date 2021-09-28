import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageService, getLanguageService } from "vscode-html-languageservice";
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';

export function getHTMLMode(htmlLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode {
	return {
		getId() {
			return 'html';
		},
		doComplete(document: TextDocument, position: Position) {
			const embedded = documentRegions.get(document).getEmbeddedDocument('html');
			const html = htmlLanguageService.parseHTMLDocument(embedded);
			return htmlLanguageService.doComplete(embedded, position, html);
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
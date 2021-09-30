import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageService } from "vscode-html-languageservice";
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';

export function getHTMLMode(htmlLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode {
	return {
		getId() {
			return 'html';
		},
		// doValidation(document: TextDocument) {
		// 	// Get virtual CSS document, with all non-CSS code replaced with whitespace
		// 	const embedded = documentRegions.get(document).getEmbeddedDocument('html');
		// 	const stylesheet = htmlLanguageService.parseHTMLDocument(embedded);
		// 	return htmlLanguageService.(embedded, stylesheet);
		// },
		doComplete(document: TextDocument, position: Position) {
			const embedded = documentRegions.get(document).getEmbeddedDocument('html');
			const html = htmlLanguageService.parseHTMLDocument(embedded);
			console.log("called html do complete", `'${embedded.getText()}'`);
			return htmlLanguageService.doComplete(embedded, position, html);
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
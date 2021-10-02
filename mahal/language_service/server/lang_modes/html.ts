import { Position, TextDocument } from 'vscode-languageserver-textdocument';
import { LanguageService } from "vscode-html-languageservice";
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
import { doComplete } from "vscode-emmet-helper";
import { CompletionList } from 'vscode-html-languageservice';
export function getHTMLMode(htmlLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode {
	return {
		getId() {
			return 'html';
		},
		// doValidation(document: TextDocument) {
		// 	// Get virtual CSS document, with all non-CSS code replaced with whitespace
		// 	const embedded = documentRegions.get(document).getEmbeddedDocument('html');
		// 	const stylesheet = htmlLanguageService.parseHTMLDocument(embedded);
		// 	return htmlLanguageService (embedded, stylesheet);
		// },
		doComplete(document: TextDocument, position: Position) {
			// getEmmetCompletionParticipants
			const embedded = documentRegions.get(document).getEmbeddedDocument('html');
			const html = htmlLanguageService.parseHTMLDocument(embedded);
			// htmlLanguageService.doTagComplete()
			console.log("called html do complete", `'${embedded.getText()}'`);
			// const list = doComplete(embedded, position, 'html', {
			// });
			try {
				const list = htmlLanguageService.doComplete(
					embedded, position, html
				);
				const emmetResults = (
					doComplete(embedded, position, 'html', {}) || {}
				).items || [];

				return CompletionList.create([
					...emmetResults,
					...list.items
				],
					emmetResults.length > 0
				)
			} catch (error) {
				console.error("error", error);
				return null;
			}

			// console.log("list", list.items);
			// return list;
		},
		doTagComplete(document: TextDocument, position: Position) {
			const embedded = documentRegions.get(document).getEmbeddedDocument('html');
			const html = htmlLanguageService.parseHTMLDocument(embedded);
			return htmlLanguageService.doTagComplete(
				document, position, html
			)
		},
		onDocumentRemoved(_document: TextDocument) { /* nothing to do */ },
		dispose() { /* nothing to do */ }
	};
}
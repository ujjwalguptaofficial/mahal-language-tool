import { getLanguageService as getHTMLLanguageService } from "vscode-html-languageservice";
import { getCSSLanguageService } from "vscode-css-languageservice";
import { getLanguageCache } from "./get_language_cache";
import { ILanguageCache, ILanguageMode, ILanguageModeRange, ILanguageModes, IMahalDocumentRegion } from "../interfaces";
import { getCSSMode, getHTMLMode } from "../lang_modes";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { getDocumentRegions } from "./get_document_regions";
import { Range } from "vscode-languageserver";

export function getLanguageModes(): ILanguageModes {
    const htmlLanguageService = getHTMLLanguageService();
    const cssLanguageService = getCSSLanguageService();

    const documentRegions = getLanguageCache<IMahalDocumentRegion>(10, 60, document =>
        getDocumentRegions(htmlLanguageService, document)
    );

    let modelCaches: ILanguageCache<any>[] = [];
    modelCaches.push(documentRegions);

    let modes = Object.create(null);
    modes['html'] = getHTMLMode(htmlLanguageService, documentRegions);
    modes['css'] = getCSSMode(cssLanguageService, documentRegions);

    return {
        getModeAtPosition(
            document: TextDocument,
            position: Position
        ): ILanguageMode | undefined {
            const languageId = documentRegions.get(document).getLanguageAtPosition(position);
            if (languageId) {
                return modes[languageId];
            }
            return undefined;
        },
        getModesInRange(document: TextDocument, range: Range): ILanguageModeRange[] {
            return documentRegions
                .get(document)
                .getLanguageRanges(range)
                .map(r => {
                    return <ILanguageModeRange>{
                        start: r.start,
                        end: r.end,
                        mode: r.languageId && modes[r.languageId],
                        attributeValue: r.attributeValue
                    };
                });
        },
        getAllModesInDocument(document: TextDocument): ILanguageMode[] {
            const result = [];
            for (const languageId of documentRegions.get(document).getLanguagesInDocument()) {
                const mode = modes[languageId];
                if (mode) {
                    result.push(mode);
                }
            }
            return result;
        },
        getAllModes(): ILanguageMode[] {
            const result = [];
            for (const languageId in modes) {
                const mode = modes[languageId];
                if (mode) {
                    result.push(mode);
                }
            }
            return result;
        },
        getMode(languageId: string): ILanguageMode {
            return modes[languageId];
        },
        onDocumentRemoved(document: TextDocument) {
            modelCaches.forEach(mc => mc.onDocumentRemoved(document));
            for (const mode in modes) {
                modes[mode].onDocumentRemoved(document);
            }
        },
        dispose(): void {
            modelCaches.forEach(mc => mc.dispose());
            modelCaches = [];
            for (const mode in modes) {
                modes[mode].dispose();
            }
            modes = {};
        }
    };
}

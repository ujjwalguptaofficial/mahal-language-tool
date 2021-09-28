import { LanguageService } from "vscode-html-languageservice";
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
export declare function getHTMLMode(htmlLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode;

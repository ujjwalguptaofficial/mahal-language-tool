import { LanguageService as CSSLanguageService } from 'vscode-css-languageservice';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
export declare function getCSSMode(cssLanguageService: CSSLanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode;

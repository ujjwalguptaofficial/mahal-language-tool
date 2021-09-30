import { LanguageService } from 'vscode-typescript-languageservice';
import { ILanguageCache, ILanguageMode, IMahalDocumentRegion } from '../interfaces';
export declare function getJSMode(jsLanguageService: LanguageService, documentRegions: ILanguageCache<IMahalDocumentRegion>): ILanguageMode;

import { TextDocument } from "vscode-languageserver-textdocument";
import { ILanguageCache } from "../interfaces";
export declare function getLanguageCache<T>(maxEntries: number, cleanupIntervalTimeInSec: number, parse: (document: TextDocument) => T): ILanguageCache<T>;

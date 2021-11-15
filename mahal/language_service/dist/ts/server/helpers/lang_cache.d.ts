import { TextDocument } from "vscode-languageserver-textdocument";
import { ILangCache } from "../interfaces";
export declare function getLanguageModelCache<T>(maxEntries: number, cleanupIntervalTimeInSec: number, parse: (document: TextDocument) => T): ILangCache<T>;

import { Range } from "vscode-languageserver";
export interface ILanguageRange extends Range {
    languageId: string | undefined;
    attributeValue?: boolean;
}

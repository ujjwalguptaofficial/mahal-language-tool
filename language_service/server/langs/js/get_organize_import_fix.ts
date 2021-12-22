import { CodeActionDataKind, OrganizeImportsActionData } from "../../interfaces";
import { CodeAction, CodeActionContext, CodeActionKind } from "vscode-languageserver/node";
import { JsLang } from ".";

export function getOrganizeImportFix(
    lang: JsLang,
    uri: string,
    textRange: { pos: number; end: number },
    context: CodeActionContext,
) {
    const result: CodeAction[] = [];

    if (
        !context.only ||
        (!context.only.includes(CodeActionKind.SourceOrganizeImports) && !context.only.includes(CodeActionKind.Source))
    ) {
        return result;
    }


    const languageId = lang.id;

    result.push({
        title: 'Organize Imports',
        kind: CodeActionKind.SourceOrganizeImports,
        data: {
            uri,
            languageId,
            textRange,
            kind: CodeActionDataKind.OrganizeImports
        } as OrganizeImportsActionData
    });

    return result;
}
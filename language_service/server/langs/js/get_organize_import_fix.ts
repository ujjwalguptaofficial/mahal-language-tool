import { CodeActionDataKind, EmbeddedRegion, OrganizeImportsActionData } from "../../interfaces";
import { CodeAction, CodeActionContext, CodeActionKind, Position } from "vscode-languageserver/node";
import { JsLang } from ".";

export function getOrganizeImportFix(
    lang: JsLang,
    uri: string,
    textRange: { pos: number; end: number },
    context: CodeActionContext,
    region: EmbeddedRegion,
    position: Position
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
            kind: CodeActionDataKind.OrganizeImports,
            position,
            region: region
        } as OrganizeImportsActionData
    });

    return result;
}
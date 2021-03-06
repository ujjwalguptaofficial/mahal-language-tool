import { TextRange } from "typescript";
import { CodeAction, Position, TextEdit, CodeActionContext } from "vscode-languageserver/node";
import { JsLang } from ".";
import { CodeActionDataKind, EmbeddedRegion, RefactorActionData } from "../../interfaces";
import { getCodeActionKind } from "./code_action_kind_converter";

export function getRefactorFix(lang: JsLang, uri: string, fileName: string, textRange: TextRange, context: CodeActionContext, region: EmbeddedRegion, position: Position) {

    const actions: RefactorActionData[] = [];
    const results: CodeAction[] = [];
    const languageId = lang.id;
    const refactorings = lang.langService.getApplicableRefactors(
        fileName,
        textRange,
        lang.preferences,
        !context.only ? undefined : 'invoked'
    );
    // console.log('refactorings', refactorings.length);
    for (const refactoring of refactorings) {
        const refactorName = refactoring.name;
        if (refactoring.inlineable) {
            actions.push({
                uri,
                kind: CodeActionDataKind.RefactorAction,
                languageId,
                textRange,
                refactorName,
                actionName: refactorName,
                description: refactoring.description,
                position,
                region
            });
        } else {
            actions.push(
                ...refactoring.actions.map(action => {
                    return {
                        uri,
                        kind: CodeActionDataKind.RefactorAction as any,
                        languageId,
                        textRange,
                        refactorName,
                        actionName: action.name,
                        description: action.description,
                        notApplicableReason: action.notApplicableReason,
                        position,
                        region
                    }
                })
            );
        }
    }
    for (const action of actions) {
        results.push({
            title: action.description,
            kind: getCodeActionKind(action),
            disabled: action.notApplicableReason ? { reason: action.notApplicableReason } : undefined,
            data: action
        });
    }
    return results;
}
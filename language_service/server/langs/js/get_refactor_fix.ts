import { TextRange } from "typescript";
import { CodeAction, CodeActionContext } from "vscode-languageserver/node";
import { JsLang } from ".";
import { CodeActionDataKind, RefactorActionData } from "../../interfaces";
import { getCodeActionKind } from "./code_action_kind_converter";

export function getRefactorFix(lang: JsLang, uri: string, fileName: string, textRange: TextRange, context: CodeActionContext) {

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
                description: refactoring.description
            });
        } else {
            actions.push(
                ...refactoring.actions.map(action => ({
                    uri,
                    kind: CodeActionDataKind.RefactorAction as any,
                    languageId,
                    textRange,
                    refactorName,
                    actionName: action.name,
                    description: action.description,
                    notApplicableReason: action.notApplicableReason
                }))
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
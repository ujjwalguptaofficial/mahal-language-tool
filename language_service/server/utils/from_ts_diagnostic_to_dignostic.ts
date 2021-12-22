import { DiagnosticCategory } from "typescript";
import { DiagnosticSeverity } from "vscode-languageserver/node";

export function fromTsDiagnosticCategoryToDiagnosticSeverity(c: DiagnosticCategory) {
    switch (c) {
        case DiagnosticCategory.Error:
            return DiagnosticSeverity.Error;
        case DiagnosticCategory.Warning:
            return DiagnosticSeverity.Warning;
        case DiagnosticCategory.Message:
            return DiagnosticSeverity.Information;
        case DiagnosticCategory.Suggestion:
            return DiagnosticSeverity.Hint;
        default:
            return DiagnosticSeverity.Error;
    }
}

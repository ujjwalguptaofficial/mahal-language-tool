import { ScriptElementKind } from "typescript";
import { SymbolKind } from "vscode-languageserver/node";

export function toSymbolKind(kind: ScriptElementKind): SymbolKind {
    switch (kind) {
        case 'var':
        case 'local var':
        case 'const':
            return SymbolKind.Variable;
        case 'function':
        case 'local function':
            return SymbolKind.Function;
        case 'enum':
            return SymbolKind.Enum;
        case 'module':
            return SymbolKind.Module;
        case 'class':
            return SymbolKind.Class;
        case 'interface':
            return SymbolKind.Interface;
        case 'method':
            return SymbolKind.Method;
        case 'property':
        case 'getter':
        case 'setter':
            return SymbolKind.Property;
    }
    return SymbolKind.Variable;
}
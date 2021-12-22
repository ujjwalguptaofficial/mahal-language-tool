interface SemanticTokenClassification {
    classificationType: number;
    modifierSet: number;
}

export interface ISemanticTokenData extends SemanticTokenClassification {
    line: number;
    character: number;
    length: number;
}

export interface ISemanticTokenOffsetData extends SemanticTokenClassification {
    start: number;
    length: number;
}

export const SEMANTIC_TOKEN_CONTENT_LENGTH_LIMIT = 80000;
export const NON_SCRIPT_TRIGGERS = ['<', '*', ':'];
export enum TokenEncodingConsts {
    typeOffset = 8,
    modifierMask = (1 << typeOffset) - 1
}

/* tslint:disable:max-line-length */
/**
 * extended from https://github.com/microsoft/TypeScript/blob/35c8df04ad959224fad9037e340c1e50f0540a49/src/services/classifier2020.ts#L9
 * so that we don't have to map it into our own legend
 */
export enum TokenType {
    class,
    enum,
    interface,
    namespace,
    typeParameter,
    type,
    parameter,
    variable,
    enumMember,
    property,
    function,
    member
}

/* tslint:disable:max-line-length */
/**
 * adopted from https://github.com/microsoft/TypeScript/blob/35c8df04ad959224fad9037e340c1e50f0540a49/src/services/classifier2020.ts#L13
 * so that we don't have to map it into our own legend
 */
export enum TokenModifier {
    declaration,
    static,
    async,
    readonly,
    defaultLibrary,
    local,

    refValue
}
import { CompilerOptions, JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from "typescript";

export const getCompilationSetting = (tsConfig: CompilerOptions) => {
    const defaultCompilerOptions: CompilerOptions = {
        allowNonTsExtensions: true,
        allowJs: true,
        lib: ['lib.dom.d.ts', 'lib.es2017.d.ts'],
        target: ScriptTarget.Latest,
        module: ModuleKind.CommonJS,
        jsx: JsxEmit.Preserve,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        // moduleResolution: ModuleResolutionKind.NodeJs,

    };

    defaultCompilerOptions.lib.forEach(item => {
        if (!tsConfig.lib.includes(item)) {
            tsConfig.lib.push(item);
        }
    })

    tsConfig.moduleResolution = getModuleResolutionKind(tsConfig.moduleResolution as any);

    return {
        ...defaultCompilerOptions,
        ...tsConfig
    }
}

function getModuleResolutionKind(moduleResolution: string) {
    console.log("getModuleResolutionKind", moduleResolution);
    switch (moduleResolution.toLowerCase()) {
        case "classic":
            return ModuleResolutionKind.Classic;
        case "node":
            return ModuleResolutionKind.NodeJs;
    }
}
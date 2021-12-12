import { createLanguageService, LanguageServiceHost, findConfigFile, sys, CompilerOptions, getDefaultLibFilePath, ScriptSnapshot, createLanguageServiceSourceFile, createDocumentRegistry, LanguageServiceMode, resolveModuleName, Extension, ModuleResolutionHost, ModuleResolutionKind } from "typescript";
import { InitializeParams } from "vscode-languageserver-protocol";
import { DocManager } from "../managers";
import { getCompilationSetting, getURLFromPath, getFilePathFromURL } from "../utils";

export class TypeScriptService {
    workSpaceDir: string;
    tsConfig: CompilerOptions;

    get fileNames() {
        return Array.from(this.docManager.docs.keys())
    }

    host: LanguageServiceHost;

    constructor(params: InitializeParams, private docManager: DocManager) {
        const workspace = params.workspaceFolders;
        if (workspace.length === 0) {
            const activeWorkSpace = workspace[0];
            this.workSpaceDir = getFilePathFromURL(activeWorkSpace.uri);
        }
        else {
            this.workSpaceDir = process.cwd()
        }
        console.log('workSpaceDir', this.workSpaceDir);

        this.tsConfig = this.getCompilerOptions_();
        // this.registerFileEvents_();
        this.host = this.createHost_();
    }

    private getCompilerOptions_() {
        const tsConfigPath = findConfigFile(this.workSpaceDir, sys.fileExists, 'tsconfig.json') ||
            findConfigFile(this.workSpaceDir, sys.fileExists, 'jsconfig.json');
        let tsConfigCompilerOptions = {};
        if (tsConfigPath) {
            const tsConfigContent = sys.readFile(tsConfigPath);
            try {
                tsConfigCompilerOptions = JSON.parse(tsConfigContent).compilerOptions;
            } catch (error) {

            }
        };
        const tsConfig = getCompilationSetting(tsConfigCompilerOptions);
        console.log('path', tsConfigPath);
        console.log('tsconfig', tsConfig);
        return tsConfig;
    }

    // private getFileName(fileName: string) {
    //     if (fileName.includes('.mahal')) {
    //         return fileName.substr(0, fileName.length - 3)
    //     }
    //     return fileName;
    // }

    // private registerFileEvents_() {
    //     const fileNames = Array.from(this.docManager.docs.keys())
    //     console.log("dir", fileNames);
    //     this.docManager.on(DOC_EVENT.AddDocument, (uri: string) => {
    //         // uri = uri + ".ts";
    //         fileNames.push(uri);
    //         console.log("fileNames", fileNames);
    //     });
    //     this.docManager.on(DOC_EVENT.RemoveDocument, (uri: string) => {
    //         uri = uri + ".ts";
    //         const index = fileNames.findIndex(file => file === uri);
    //         if (index >= 0) {
    //             fileNames.splice(index, 1);
    //         }
    //         console.log("fileNames", fileNames);
    //     });
    // }

    private createHost_() {
        // const getFileName = this.getFileName;
        const docManager = this.docManager;
        const host: LanguageServiceHost = {
            getCompilationSettings: () => {
                return this.tsConfig;
            },
            getCurrentDirectory: () => {
                return this.workSpaceDir
            },
            getDefaultLibFileName: (options) => {
                const libPath = getDefaultLibFilePath(options);
                return libPath;
            },
            getScriptFileNames: () => {
                return this.fileNames;
            },
            getScriptSnapshot: (filePath) => {
                // console.log("getScriptSnapshot filePath", filePath)

                let fileText;
                if (filePath.includes('node_modules')) {
                    fileText = sys.readFile(getFilePathFromURL(filePath)) || '';
                }
                else {
                    if (docManager.isDocExist(filePath)) {
                        const { doc } = docManager.getEmbeddedDocument(
                            getURLFromPath(filePath),
                            'javascript'
                        );
                        fileText = doc ? doc.getText() : '';
                    }
                    else {
                        fileText = host.readFile(filePath)
                    }
                }

                // console.log("scriptSnapShpt", uri, filePath, fileText, Array.from(docManager.docs.keys()));
                // console.log("fileText", fileText.length);
                return ScriptSnapshot.fromString(fileText);
            },
            getScriptVersion: (filePath) => {
                if (filePath.includes('node_modules')) {
                    return '0';
                }
                // const uri = getFileName(filePath);
                // console.log("getScriptVersion uri", uri);
                const doc = docManager.getByPath(filePath);
                // console.log("getScriptVersion", filePath, doc);
                const version = doc ? doc.version : (docManager.externalDocs.get(filePath) || 0);
                console.log('version', version, filePath);
                return version.toString();
            },
            fileExists: (fileName) => {
                const value = sys.fileExists(getFilePathFromURL(fileName));
                return value;
            },
            directoryExists: (directory) => {
                const value = sys.directoryExists(getFilePathFromURL(directory));
                return value;
            },
            readDirectory: (filePath) => {
                const value = sys.readDirectory(getFilePathFromURL(filePath));
                return value;
            },
            readFile: (filePath) => {
                const value = sys.readFile(getFilePathFromURL(filePath));
                return value;
            },
            useCaseSensitiveFileNames: () => true,
            getDirectories: (filePath: string) => {
                const value = sys.getDirectories(getFilePathFromURL(filePath));
                return value;
            },
            resolveModuleNames: (moduleNames: string[], containingFile: string) => {

                const moduleHost: ModuleResolutionHost = {
                    fileExists: host.fileExists,
                    directoryExists: host.directoryExists,
                    readFile: host.readFile,
                    getCurrentDirectory: host.getCurrentDirectory,
                    getDirectories: host.getDirectories,
                    useCaseSensitiveFileNames: true,
                };
                return moduleNames.map(moduleName => {
                    const item = resolveModuleName(
                        moduleName,
                        getFilePathFromURL(containingFile),
                        this.tsConfig,
                        moduleHost
                    );
                    // return null;
                    // console.log("item", item);
                    return item.resolvedModule;
                })
            },
        };
        return host;
    }

    getLangService() {
        const registry = createDocumentRegistry(
            true, this.workSpaceDir
        );

        return createLanguageService(this.host, registry);

    }
}


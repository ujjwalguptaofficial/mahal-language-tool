import { createLanguageService, LanguageServiceHost, findConfigFile, sys, CompilerOptions, getDefaultLibFilePath, ScriptSnapshot, createLanguageServiceSourceFile, createDocumentRegistry, LanguageServiceMode, resolveModuleName, Extension, ModuleResolutionHost, ModuleResolutionKind } from "typescript";
import { InitializeParams } from "vscode-languageserver-protocol";
import { DocManager } from "../managers";
import { DOC_EVENT } from "../enums";
import { getCompilationSetting, getFilePathFromURL } from "../utils";


export function getTypescriptService(params: InitializeParams, docManager: DocManager) {

    const workspace = params.workspaceFolders;
    if (workspace.length === 0) {
        return console.error("no workspace found");
    }

    const activeWorkSpace = workspace[0];

    const workSpaceDir = getFilePathFromURL(activeWorkSpace.uri);

    console.log('workSpaceDir', workSpaceDir);

    const tsConfigPath = findConfigFile(process.cwd(), sys.fileExists, 'tsconfig.json') ||
        findConfigFile(workSpaceDir, sys.fileExists, 'jsconfig.json');
    let tsConfigCompilerOptions = {};
    if (tsConfigPath) {
        const tsConfigContent = sys.readFile(tsConfigPath);
        try {
            tsConfigCompilerOptions = JSON.parse(tsConfigContent).compilerOptions;
        } catch (error) {

        }
    };

    let tsConfig: CompilerOptions = getCompilationSetting(tsConfigCompilerOptions);

    console.log('path', tsConfigPath);
    console.log('tsconfig', tsConfig);


    // const fileNames = sys.readDirectory(
    //     workSpaceDir, ['mahal', 'mhl']
    // ).map(item => {
    //     return pathToFileURL(item + ".ts").href;
    // })
    // fileNames.push(
    //     getDefaultLibFilePath(tsConfig)
    // )
    const fileNames = Array.from(docManager.docs.keys())
    console.log("dir", fileNames);
    docManager.on(DOC_EVENT.AddDocument, (uri: string) => {
        uri = uri + ".ts";
        fileNames.push(uri);
        console.log("fileNames", fileNames);
    });
    docManager.on(DOC_EVENT.RemoveDocument, (uri: string) => {
        uri = uri + ".ts";
        const index = fileNames.findIndex(file => file === uri);
        if (index >= 0) {
            fileNames.splice(index, 1);
        }
        console.log("fileNames", fileNames);
    });
    const getFileName = (fileName: string) => {
        if (fileName.includes('.mahal')) {
            return fileName.substr(0, fileName.length - 3)
        }
        return fileName;
    }

    // activeWorkSpace.uri
    const host: LanguageServiceHost = {
        getCompilationSettings() {
            return tsConfig;
        },
        getCurrentDirectory() {
            return workSpaceDir
        },
        getDefaultLibFileName(options) {
            const libPath = getDefaultLibFilePath(options);
            // console.log("libPath", libPath);
            // console.log("options", options);
            return libPath;
        },
        getScriptFileNames() {
            // const files = Array.from(docManager.docs.keys as any).map(item => {
            //     return item + ".ts"
            // });
            // console.log("getScriptFileNames", files);
            return fileNames;
        },
        getScriptSnapshot(filePath) {
            // console.log("getScriptSnapshot filePath", filePath)

            let fileText;
            if (filePath.includes('node_modules')) {
                fileText = sys.readFile(getFilePathFromURL(filePath)) || '';
            }
            else {
                const uri = getFileName(filePath);
                if (docManager.isDocExist(uri)) {
                    // console.log("uri", uri);
                    const { doc } = docManager.getEmbeddedDocument(
                        uri,
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
        getScriptVersion(filePath) {
            if (filePath.includes('node_modules')) {
                return '0';
            }
            const uri = getFileName(filePath);
            // console.log("getScriptVersion uri", uri);
            const doc = docManager.getByURI(uri);
            // console.log("getScriptVersion", filePath, doc);
            const version = doc ? doc.version : 0;
            return version.toString();
        },
        fileExists(fileName) {
            const value = sys.fileExists(getFilePathFromURL(fileName));
            // console.log("fileExists", fileName, value);
            return value;
        },
        directoryExists(directory) {
            const value = sys.directoryExists(getFilePathFromURL(directory));
            // console.log("directory", directory, value);
            return value;
        },
        readDirectory(filePath) {
            const value = sys.readDirectory(getFilePathFromURL(filePath));
            console.log("readDirectory", filePath, value);
            return value;
        },
        readFile(filePath) {
            const value = sys.readFile(getFilePathFromURL(filePath));
            // console.log("readFile", filePath);
            return value;
        },
        useCaseSensitiveFileNames: () => true,
        getDirectories(filePath: string) {
            const value = sys.getDirectories(getFilePathFromURL(filePath));
            // console.log('getDirectories path', filePath);
            return value;
        },
        resolveModuleNames(moduleNames: string[], containingFile: string) {

            containingFile = getFileName(containingFile);
            // console.log("moduleNames", moduleNames, "containingFile", containingFile);
            // return [];
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
                    tsConfig,
                    moduleHost
                );
                // return null;
                // console.log("item", item);
                return item.resolvedModule;
            })
        },

    };
    const registry = createDocumentRegistry(
        true, workSpaceDir
    );

    const newService = createLanguageService(host, registry);

    return newService;
}


const path = require('path')

exports.default = {
    // mode:,
    devtool: 'source-map',
    entry: `./server/index.ts`,
    target: 'node',
    output: {
        path: path.join(__dirname, "./../dist"),
        filename: `server.js`,
        library: 'mahal_language_server',
        libraryTarget: 'commonjs2',
    },
    externals: {
        vscode: 'vscode',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        modules: [path.resolve(__dirname, 'src'), 'node_modules'],
        extensions: ['.json', '.js', '.ts', 'tsx'],
        alias: {
            // "@": path.resolve(__dirname, "./src")
        },
    },
    plugins: [

    ],

}
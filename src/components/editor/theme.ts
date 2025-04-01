import * as monaco from 'monaco-editor';

export const theme: monaco.editor.IStandaloneThemeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "pipe-element", foreground: "#00AA00", fontStyle: "bold" },
        { token: "editor-variable", foreground: "#00aaaa"},
    ],
    colors: {
    },
};

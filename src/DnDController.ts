import * as vscode from 'vscode';

export class DnDController implements vscode.TreeDragAndDropController<vscode.TreeItem> {
    dragMimeTypes: string[] = ['files','application/vnd.code.tree.remoteExplorer'];
    dropMimeTypes: string[] = ['text/uri-list'];
    handleDrag(source: readonly vscode.TreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        console.log(source, dataTransfer, 'handleDrag');
    }
    handleDrop(target: vscode.TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        console.log(target, dataTransfer, 'handleDrop');
        let files = dataTransfer.get('text/uri-list');
        console.log({ files });
    }
}
import * as vscode from 'vscode';

export class DnDController implements vscode.TreeDragAndDropController<vscode.TreeItem> {
    dragMimeTypes: string[] = [];
    dropMimeTypes: string[] = [];
    handleDrag(source: readonly vscode.TreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        console.log(source, dataTransfer, 'handleDrag');
    }
    handleDrop(target: vscode.TreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        console.log(target, dataTransfer, 'handleDrop');
    }
}
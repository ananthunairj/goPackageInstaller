import * as vscode from "vscode";
import { versionGetter } from "./version";


export async function versionFinder(importPath: string) {
  if (importPath !== null) {
    return versionGetter(importPath);
  }
}


export async function terminalExecutor(
  repoPath: string,
  version: string | null
) {
  if (version !== null) {
    const terminal = vscode.window.createTerminal("Go Installer");
    terminal.show(true);
    terminal.sendText(`go get github.com/${repoPath}@${version}`);
  } else {
    const terminal = vscode.window.createTerminal("Go Installer");
    terminal.show(true);
    terminal.sendText(`go get -u github.com/${repoPath}`);
  }
  await importWriter(repoPath);
}

async function importWriter(url: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }
  const doc = editor.document;
  const filePath = doc.uri.fsPath;

  if (!filePath.endsWith(".go")) {
    vscode.window.showErrorMessage("Current file is not a Go file.");
    return;
  }

  const text = doc.getText();
  const edit = new vscode.WorkspaceEdit();
  const importLine = `\t"github.com/${url}"\n`;

  const importBlockMatch = text.match(/import\s+\(([\s\S]*?)\)/);

  if (importBlockMatch) {
    const importStartIndex = importBlockMatch.index!;
    const importBlock = importBlockMatch[0];
    const insertPos = importStartIndex + importBlock.length - 1;

    const insertPosition = doc.positionAt(insertPos);
    edit.insert(doc.uri, insertPosition, importLine);
  } else {
    const packageMatch = text.match(/^package\s+\w+/m);

    if (!packageMatch) {
      vscode.window.showErrorMessage("No 'package' statement found.");
      return;
    }
    const packageEndPos = doc.positionAt(
      packageMatch.index! + packageMatch[0].length
    );
    const newImportBlock = `\n\nimport (\n${importLine})\n`;
    edit.insert(doc.uri, packageEndPos, newImportBlock);
  }

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`Added import "${url}"`);
}

import * as vscode from "vscode";
import { characterChecker } from "./helpers/charcorrector";
import { checkingPackage } from "./api/packagechecker";
import { terminalExecutor, versionFinder } from "./helpers/terminalrunner";

export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "go-package-installer" is now active!'
  );

const disposable = vscode.commands.registerCommand(
  "go-package-installer.helloWorld",
  async () => {
    const userInput = await vscode.window.showInputBox({
      placeHolder: "Enter GO package Keyword⚡",
    });

    if (userInput) {
      const keyword: string = characterChecker(userInput) as string;
      let resultpackages: { topResults: string[]; rawResults: string[];  repositoryPath : string[] } | undefined;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Searching for "${userInput}"`,
          cancellable: false,
        },
        async () => {
          resultpackages = await checkingPackage(keyword);
       
        }
      );

      if (
        Array.isArray(resultpackages?.topResults) &&
        resultpackages.topResults.length > 0
      ) {
        const quickPickItems = resultpackages.topResults.map((label, i) => ({
          label: label,
          description: "",
          detail: "",
          rawUrl: resultpackages!.rawResults[i],
          repoPath: resultpackages!.repositoryPath[i],
    
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: "Select a Go package",
        });

        if (selected) {
          const url = selected.repoPath;
          

          const action = await vscode.window.showQuickPick(
            ["📦 Install package", "🌐 Open on pkg.go.dev"],
            {
              placeHolder: `What do you want to do with "${url}"?`,             
            }
          );

          if (action === "🌐 Open on pkg.go.dev") {
            vscode.env.openExternal(vscode.Uri.parse(selected.rawUrl));
            return;
          }

          if (action === "📦 Install package") {
            let versions: string[] | undefined;

            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Searching for "${url}"`,
                cancellable: false,
              },
              async () => {
                versions = await versionFinder(url);
              }
            );

            if (Array.isArray(versions) && versions.length > 0) {
              const selectVersion = await vscode.window.showQuickPick(versions, {
                placeHolder: "Choose Package Version",
              });

              if (selectVersion) {
                terminalExecutor(url, selectVersion);
              } else {
                vscode.window.showErrorMessage("Invalid package version");
              }
            } else {
              vscode.window.showErrorMessage("No version found");
            }
          }
        }
      } else {
        vscode.window.showErrorMessage("No package found");
      }
    }
  }
);

context.subscriptions.push(disposable);


}

export function deactivate() {}

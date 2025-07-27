# Go Packager

A Visual Studio Code extension to streamline packaging of Go projects. Bundle your Go source into a single distributable file with one click.

![Animated Preview](assets/go-packager-anim.gif)

## Features

- **One-Click Packaging**  
  Run your Go build and package commands right from the Command Palette.

- **Customizable Build Tasks**  
  Define your own `go build` flags and output path in your workspace settings.

- **Integrated Status & Logs**  
  See build progress, errors, and success notifications inline.

- **Multi-Platform Support**  
  Automatically detect and target Windows, macOS, and Linux binaries.

## Installation

1. Open the **Extensions** sidebar in VS Code (`Ctrl+Shift+X` / `⌘+Shift+X`).
2. Search for **“Go Packager”**.
3. Click **Install**.

Or download the `.vsix` and run:

```bash
code --install-extension go-packager-0.0.1.vsix

import { ExtensionContext, commands, window } from 'vscode';
import { GenerateTranslation } from './lib';

export const activate = (context: ExtensionContext) => {
  const generateTranslationGenerate = commands.registerCommand(
    'generateTranslation.generate',
    generate
  );
  context.subscriptions.push(generateTranslationGenerate);

  const generateTranslationFromSelectedText = commands.registerCommand(
    'generateTranslation.fromSelectedText',
    fromSelectedText
  );
  context.subscriptions.push(generateTranslationFromSelectedText);
};

const generate = async () => {
  const key = await window.showInputBox({
    prompt: `Which key do you want to use?`
  });

  const translation = await window.showInputBox({
    prompt: 'Enter translation for your base language (en)'
  });

  if (key && translation) {
    GenerateTranslation.generate(key, translation);
  }
};

const fromSelectedText = () => {
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  const selection = editor.selection;
  const textSelection = editor.document.getText(selection);

  if (!textSelection) {
    window.showWarningMessage('Nothing selected.');
    return;
  }

  GenerateTranslation.fromSelectedText(textSelection);
};

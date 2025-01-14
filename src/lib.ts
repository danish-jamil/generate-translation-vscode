import { window, workspace } from 'vscode';
import fs = require('fs');
import path = require('path');
import { languages } from './languages';
const translate = require('google-translate-open-api').default;

let dotProp = require('dot-prop-immutable');

export abstract class GenerateTranslation {
  private static _editor = window.activeTextEditor;
  public static generate(key: string, translation?: string) {
    GenerateTranslation.fromSelectedText(key, translation);
  }

  public static detectLanguage(filePath: string) {
    const startIndex = filePath.lastIndexOf('\\');
    const fileName = filePath.substr(startIndex + 1, 2);
    const lang = languages.find(lang => fileName.includes(lang.value));
    if (lang) {
      return lang.value;
    }
    return null;
  }

  public static async fromSelectedText(
    textSelection: string,
    translation?: string
  ) {
    try {
      const path = workspace
        .getConfiguration('generate-translation')
        .get('path');
      const preferredLanguage =
        workspace
          .getConfiguration('generate-translation')
          .get('preferredLanguage') || 'en';
      let pathToFind = `${workspace.rootPath}${path}`;
      const translateFiles = GenerateTranslation.getFiles(
        pathToFind,
        '.json',
        null,
        []
      );

      translateFiles.sort((a, b) =>
        this.detectLanguage(a) === preferredLanguage ? -1 : 1
      );
      const preferredLanguageFile = translateFiles.shift() as string;
      this.generateTranslation(
        preferredLanguageFile,
        pathToFind,
        textSelection,
        translation as string,
        preferredLanguage as string
      );

      for (let i = 0; i < translateFiles.length; i++) {
        const file = translateFiles[i];
        this.generateTranslation(
          file,
          pathToFind,
          textSelection,
          translation as string,
          preferredLanguage as string
        );
      }
    } catch (error) {
      window.showErrorMessage(error.message);
    }
  }

  static async generateTranslation(
    file: string,
    pathToFind: string,
    textSelection: string,
    translation: string,
    preferredLanguage: string
  ) {
    let translateObject = JSON.parse(fs.readFileSync(file, 'utf-8'));

    const translateObjectName = file.replace(`${pathToFind}`, '');

    const language = this.detectLanguage(file);

    if (dotProp.get(translateObject, textSelection)) {
      window.showErrorMessage(
        `${textSelection} already exists in the file ${translateObjectName}.`
      );
    } else {
      let value = '';
      if (translation && language === preferredLanguage) {
        value = translation;
      } else {
        const res = await translate(translation, {
          from: preferredLanguage,
          to: language
        });
        value = res.data[0];
      }

      if (value) {
        const arrTextSelection = textSelection.split('.');
        arrTextSelection.pop();

        const valueLastKey = dotProp.get(
          translateObject,
          arrTextSelection.join('.')
        );
        if (valueLastKey && typeof valueLastKey === 'string') {
          const newObject = {
            [arrTextSelection[arrTextSelection.length - 1]]: valueLastKey
          };

          translateObject = dotProp.set(
            translateObject,
            arrTextSelection.join('.'),
            newObject
          );
        }

        translateObject = dotProp.set(
          translateObject,
          GenerateTranslation.normalizeKey(textSelection),
          value
        );

        await GenerateTranslation.updateFile(
          file,
          translateObject,
          translateObjectName
        );

        window.showInformationMessage(
          `${textSelection} added in the file ${translateObjectName}.`
        );

        GenerateTranslation.replaceOnTranslate(textSelection);
      }
    }
  }

  private static replaceOnTranslate(textSelection: string) {
    const editor = window.activeTextEditor;
    const replaceForExtensions = <Array<string>>(
      workspace
        .getConfiguration('generate-translation')
        .get('replaceForExtensions')
    );
    const templateSnippetToReplace = <string>(
      workspace
        .getConfiguration('generate-translation')
        .get('templateSnippetToReplace')
    );

    const extname = path.extname(editor.document.fileName);

    if (
      editor &&
      replaceForExtensions.indexOf(extname.replace('.', '')) > -1 &&
      templateSnippetToReplace
    ) {
      editor.edit(editBuilder => {
        editBuilder.replace(
          editor.selection,
          templateSnippetToReplace.replace('i18n', textSelection)
        );
      });
    }
  }

  private static async updateFile(
    file: string,
    translateObject: any,
    translateObjectName: string
  ) {
    try {
      let tabSizeEditor: string | number = 4;
      if (
        GenerateTranslation._editor &&
        GenerateTranslation._editor.options.tabSize
      ) {
        tabSizeEditor = GenerateTranslation._editor.options.tabSize;
      }

      const sort = workspace
        .getConfiguration('generate-translation')
        .get('sort');
      if (sort) {
        translateObject = GenerateTranslation.sortObject(translateObject);
      }

      fs.writeFile(
        file,
        JSON.stringify(translateObject, null, tabSizeEditor),
        (err: any) => {
          if (err) {
            throw err;
          }
        }
      );
    } catch {
      throw new Error(`Error saving file ${translateObjectName}.`);
    }
  }

  private static getFiles = (
    basePath: string,
    ext: string,
    files: any,
    result: any[]
  ): string[] => {
    try {
      files = files || fs.readdirSync(basePath);
      result = result || [];

      files.forEach((file: string) => {
        const newbase = <never>path.join(basePath, file);

        if (fs.statSync(newbase).isDirectory()) {
          result = GenerateTranslation.getFiles(
            newbase,
            ext,
            fs.readdirSync(newbase),
            result
          );
        } else if (file.includes(ext)) {
          result.push(newbase);
        }
      });
      return result;
    } catch {
      throw new Error(
        'No translation file was found. Check the path configured in the extension.'
      );
    }
  };

  private static sortObject = (object: any): any => {
    if (Array.isArray(object)) {
      return object.sort().map(GenerateTranslation.sortObject);
    } else if (GenerateTranslation.isPlainObject(object)) {
      return Object.keys(object)
        .sort()
        .reduce((a: any, k: any) => {
          a[k] = GenerateTranslation.sortObject(object[k]);
          return a;
        }, {});
    }

    return object;
  };

  private static isPlainObject = (object: any): boolean =>
    '[object Object]' === Object.prototype.toString.call(object);

  private static normalizeKey = (key: string) => key.replace(' ', '_');
}

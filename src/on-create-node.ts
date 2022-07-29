import path from "path";
import { defaults, isString } from "lodash";
import traverse from "traverse";
import {
  defaultPluginOptions,
  PluginOptions,
  GatsbyFile,
  MarkdownNode,
  findMatchingFile,
} from ".";
import { chekcIfExistsOnServer } from "./utils";

export type GatsbyPluginArgs = {
  node: MarkdownNode;
  getNodesByType: (type: string) => GatsbyFile[];
  reporter: {
    info: (msg: string, error?: Error) => void;
  };
};

export const onCreateNode = (
  { node, getNodesByType }: GatsbyPluginArgs,
  pluginOptions: PluginOptions
) => {
  const options = defaults(pluginOptions, defaultPluginOptions);

  if (node.internal.type === `MarkdownRemark` || node.internal.type === `Mdx`) {
    const files = getNodesByType(`File`);

    const directory = path.dirname(node.fileAbsolutePath);

    // Deeply iterate through frontmatter data for absolute paths
    traverse(node.frontmatter).forEach(async function (value) {
      if (!isString(value)) return;
      if (!path.isAbsolute(value) || !path.extname(value)) return;

      const paths = this.path.reduce<string[]>((acc, current) => {
        acc.push(acc.length > 0 ? [acc, current].join(".") : current);
        return acc;
      }, []);

      let shouldTransform = options.include.length < 1;

      if (options.include.some((a) => paths.includes(a))) {
        shouldTransform = true;
      }

      if (options.exclude.some((a) => paths.includes(a))) {
        shouldTransform = false;
      }

      if (!shouldTransform) return;

      let newValue;
      const file = findMatchingFile(value, files, options);
      if (file) {
        newValue = path.relative(directory, file.absolutePath);
      } else {
        if (!options.baseUrl) {
          throw new Error(
            `No matching file found for src "${node.url}" in static folder "${options.staticFolderName}". Please check static folder name and that file exists at "${options.staticFolderName}${node.url}". This error will probably cause a "GraphQLDocumentError" later in build. All converted field paths MUST resolve to a matching file in the "static" folder.`
          );
        }
        const fullUrl = options.baseUrl + node.url;
        const exists = await chekcIfExistsOnServer(fullUrl);
        if (!exists) {
          throw new Error(
            `No matching file found for src "${node.url}" in static folder "${options.staticFolderName}" or "${fullUrl}". Please check static folder name and that file exists at "${options.staticFolderName}${node.url}". This error will probably cause a "GraphQLDocumentError" later in build. All converted field paths MUST resolve to a matching file in the "static" folder.`
          );
        } else {
          newValue = fullUrl;
        }
      }

      this.update(newValue);
    });
  }
};

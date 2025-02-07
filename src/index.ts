import path from "path";
import { selectAll } from "unist-util-select";
import { defaults, isString, find } from "lodash";
import cheerio from "cheerio";
import { chekcIfExistsOnServer, slash } from "./utils";

export type GatsbyNodePluginArgs = {
  files: GatsbyFile[];
  markdownNode: MarkdownNode;
  markdownAST: any;
  reporter: {
    info: (msg: string, error?: Error) => void;
  };
};

export type GatsbyFile = {
  absolutePath: string;
};

export type PluginOptions = {
  staticFolderName: string;
  include: string[];
  exclude: string[];
  baseUrl: string;
};

export type FrontMatterOptions = {
  staticFolderName: string;
  include: string[];
  exclude: string[];
};

export type MarkdownNode = {
  id: string;
  parent: string;
  url: string;
  frontmatter?: object;
  internal: {
    type: string;
  };
  fileAbsolutePath: string;
};

export type Node = {
  dir: string;
};

export type HtmlNode = {
  value: string;
} & MarkdownNode;

export const defaultPluginOptions = {
  staticFolderName: "static",
  include: [],
  exclude: [],
  baseUrl: "",
};

export const findMatchingFile = (
  src: string,
  files: GatsbyFile[],
  options: PluginOptions
) => {
  const result = find(files, (file) => {
    const staticPath = slash(path.join(options.staticFolderName, src));
    return slash(path.normalize(file.absolutePath)).endsWith(staticPath);
  });
  return result;
};

export const findMatchingFileRemote = async (
  src: string,
  options: PluginOptions
) => {
  if (!options.baseUrl) {
    throw new Error(
      `No matching file found for src "${src}" in static folder "${options.staticFolderName}". Please check static folder name and that file exists at "${options.staticFolderName}${src}". This error will probably cause a "GraphQLDocumentError" later in build. All converted field paths MUST resolve to a matching file in the "static" folder.`
    );
  }
  const fullUrl = options.baseUrl + src;
  const exists = await chekcIfExistsOnServer(fullUrl);
  if (!exists) {
    throw new Error(
      `No matching file found for src "${src}" in static folder "${options.staticFolderName}" or "${fullUrl}". Please check static folder name and that file exists at "${options.staticFolderName}${src}". This error will probably cause a "GraphQLDocumentError" later in build. All converted field paths MUST resolve to a matching file in the "static" folder.`
    );
  }
  return fullUrl;
};

export default async (
  { files, markdownNode, markdownAST }: GatsbyNodePluginArgs,
  pluginOptions: PluginOptions
) => {
  // Default options
  const options = defaults(pluginOptions, defaultPluginOptions);

  if (!markdownNode.fileAbsolutePath) return;

  const directory = path.dirname(markdownNode.fileAbsolutePath);

  // Process all markdown image nodes
  selectAll("image", markdownAST).forEach(async (_node: any) => {
    const node = _node as MarkdownNode;
    if (!isString(node.url)) return;
    if (!path.isAbsolute(node.url) || !path.extname(node.url)) return;

    const file = findMatchingFile(node.url, files, options);

    if (file) {
      // Update node.url to be relative to its parent file
      node.url = path.relative(directory, file.absolutePath);
    } else {
      const remoteFileUrl = await findMatchingFileRemote(node.url, options);
      node.url = remoteFileUrl;
    }
  });

  // Process all HTML images in markdown body
  selectAll("html", markdownAST).forEach((_node: any) => {
    const node = _node as HtmlNode;

    const $ = cheerio.load(node.value);

    if ($(`img`).length === 0) return;

    $(`img`).each(async (_, element) => {
      // Get the details we need.
      const url = $(element).attr(`src`);

      // Only handle absolute (local) urls
      if (!isString(url)) return;
      if (!path.isAbsolute(url) || !path.extname(url)) return;

      const file = findMatchingFile(url, files, options);
      if (file) {
        // Make the image src relative to its parent node
        const src = path.relative(directory, file.absolutePath);
        $(element).attr("src", src);

        node.value = $(`body`).html() ?? ""; // fix for cheerio v1
      } else {
        const remoteFileUrl = await findMatchingFileRemote(node.url, options);
        $(element).attr("src", remoteFileUrl);
        node.value = $(`body`).html() ?? ""; // fix for cheerio v1
      }
    });
  });
};

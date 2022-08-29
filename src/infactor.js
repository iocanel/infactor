const { readFileSync, createWriteStream } = require('fs');

const LINE_SPILT = /\r?\n/
const getFileExtension = (file) => file.substring(file.lastIndexOf('.') + 1);
const readFile = (file) => readFileSync(file, 'utf-8');
const readFileLines = (file) => readFile(file).split(LINE_SPILT);

const writeString = (file, s) => {
    var f = createWriteStream(file);
    f.write(s);
    f.end();
}

const writeLines = (file, lines) => writeString(file, lines.join('\n'));
const writeTree = (file, tree) => writeString(file, tree.getText(tree.rootNode));

const findFirstLineMatching = (lines, expression, after = -1) => Math.min(...lines.map((line, index) => index).filter(index => index > after && lines[index].match(expression)));
const findLastLineMatching = (lines, expression, before = Number.MAX_SAFE_INTEGER) => Math.max(...lines.map((line, index) => index).filter(index => index < before && lines[index].match(expression)));

const treeSitterLangs = {
    "html": () => require("tree-sitter-html"),
    "js": () => require("tree-sitter-javascript"),
    "ts": () => require("tree-sitter-typescript").typescript,
    "tsx": () => require("tree-sitter-typescript").tsx,
    "java": () => require("tree-sitter-java")
};

const createTreeSitterForLanguage = (lang) => {
    const Parser = require('tree-sitter');
    const parser = new Parser();
    parser.setLanguage(lang);
    return parser;
}

const createTreeSitterForFile = (file) => {
    const ext = getFileExtension(file);
    const lang = treeSitterLangs[ext]();
    const parser = createTreeSitterForLanguage(lang);
    return { ext, lang, parser };
}

const parseString = (str, lang, existing = null) => {
    const parser = createTreeSitterForLanguage(lang);
    const tree = existing ? parser.parse(str, existing) : parser.parse(str);
    return { tree, parser };
}

const parseFile = (file, existing = null) => {
    let { lang, parser } = createTreeSitterForFile(file);
    var content = readFile(file);
    const tree = existing ? parser.parse(content, existing) : parser.parse(content);
    return { content, tree, lang, parser };
}

const getNodeValue = (lines, node) => lines.filter((line, index) => index <= node.endPosition.row && index >= node.startPosition.row).join('\n').substring(node.startPosition.column, node.endPosition.column);

const queryNode = (lang, tree, options, queryFunction) => {
    const { Query, QueryCursor } = require('tree-sitter');
    const query = new Query(lang, queryFunction(options));
    const matches = query.matches(tree.rootNode);
    let startRow = options.bound && options.bound.start ? options.bound.start : tree.rootNode.startPosition.row;
    let endRow = options.bound && options.bound.end ? options.bound.end : tree.rootNode.endPosition.row;
    var nodes = matches.flatMap(m => m.captures.filter(c => c.name === "target" && c.node.startPosition.row >= startRow && c.node.endPosition.row <= endRow).map(c => c.node));
    return nodes[nodes.length - 1];
}

const displayNode = (node, indent = 0) => {
    console.log(' '.repeat(indent) + node);
    node.children && node.children.forEach(c => displayNode(c, indent + 2));
}

//Class
const createClassBodyQuery = (options) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${options.inClass}") body: (_) @target)`;
const createFirstItemOfClassQuery = (options) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${options.inClass}") body: (class_body . (_) @target))`;
const createLastItemOfClassQuery = (options) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${options.inClass}") body: (class_body (_) @target .))`;

const findClassBody = (lang, tree, options) => queryNode(lang, tree, options, createClassBodyQuery);
const findFirstLineOfClsasDeclaration = (lang, tree, options) => queryNode(lang, tree, options, createFirstItemOfClassQuery);
const findLastLineOfClsasDeclaration = (lang, tree, options) => queryNode(lang, tree, options, createLastItemOfClassQuery);

//Method
const createMethodBodyQuery = (options) => `(method_declaration name: (identifier) @method_name (#eq? @method_name "${options.inMethod}") body: (_) @target )`;
const createFirstItemOfMethodQuery = (options) => `(method_declaration name: (identifier) @method_name (#eq? @method_name "${options.inMethod}") body: (block . (_) @target ))`;
const createLastItemOfMethodQuery = (options) => `(method_declaration name: (identifier) @method_name (#eq? @method_name "${options.inMethod}") body: (block (_) @target .))`;

const findMethodBody = (lang, tree, options) => queryNode(lang, tree, options, createMethodBodyQuery);
const findFirstLineOfMethod = (lang, tree, options) => queryNode(lang, tree, options, createFirstItemOfMethodQuery);
const findLastLineOfMethod = (lang, tree, options) => queryNode(lang, tree, options, createLastItemOfMethodQuery);

//Function
const createFunctionBodyQuery = (options) => `(function_declaration name: (identifier) @function_name (#eq? @function_name "${options.inFunction}") body: (_) @target)`;
const createFirstItemOfFunctionQuery = (options) => `(function_declaration name: (identifier) @function_name (#eq? @function_name "${options.inFunction}") body: (statement_block . (_) @target ) @outer)`;
const createLastItemOfFunctionQuery = (options) => `(function_declaration name: (identifier) @function_name (#eq? @function_name "${options.inFunction}") body: (statement_block (_) @target .) @outer)`;

const findFunctionBody = (lang, tree, options) => queryNode(lang, tree, options, createFunctionBodyQuery);
const findFirstLineOfFunction = (lang, tree, options) => queryNode(lang, tree, options, createFirstItemOfFunctionQuery);
const findLastLineOfFunction = (lang, tree, options) => queryNode(lang, tree, options, createLastItemOfFunctionQuery);

// Assignment
const createAssignmentQuery = (options) => `(assignment_expression left: (identifier) @var_name (#eq? @var_name "${options.variable}") right: (_) @target)`;
const findAssignmentValue = (lang, tree, options) => queryNode(lang, tree, options, createAssignmentQuery);

// Var Declaration
const createVarDeclaratorQuery = (options) => `(variable_declarator name: (identifier) @var_name (#eq? @var_name "${options.variable}") value: (_) @target)`;
const findVarDeclaratorValue = (lang, tree, options) => queryNode(lang, tree, options, createVarDeclaratorQuery);

const addImport = (newImport, file) => {
    var lines = readFileLines(file);
    var index = findLastLineMatching(lines, "^[ ]*import.*;$");
    lines.splice(index + 1, 0, "import " + newImport + ";");
    return lines.join('\n');
}

const getLine = (file, expression, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(lang, tree, options);
    }
    if (options.inFunction) {
        context = findFunctionBody(lang, tree, options);
    }
    let lines = content.split(LINE_SPILT);
    if (!context) {
        return -1;
    }
    var min = context.startPosition ? context.startPosition.row : 0;
    var max = context.endPosition ? context.endPosition.row : lines.length;
    if (options.first) {
        // the actual index differs from the line number by one
        return 1 + min + findFirstLineMatching(lines.filter((line, index) => index >= min && index <= max), expression);
    }
    return 1 + min + findLastLineMatching(lines.filter((line, index) => index >= min && index <= max), expression);
}

const addLine = (file, code, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(lang, tree, options);
    }
    if (options.inFunction) {
        context = findFunctionBody(lang, tree, options);
    }
    if (options.top) {
        return content.slice(0, context.firstChild.startIndex + 1) + "\n" + code + content.slice(context.firstChild.startIndex + 1);
    }
    return content.slice(0, context.lastChild.startIndex - 1) + "\n" + code + content.slice(context.lastChild.startIndex - 1);
}

const getValue = (file, variable, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(lang, tree, options);
        options.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(lang, tree, options);
        options.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    options.variable = variable;
    context = findAssignmentValue(lang, tree, options) || findVarDeclaratorValue(lang, tree, options);
    return content.slice(context.startIndex, context.endIndex);
}

const setValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(lang, tree, options);
        opiotns.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(lang, tree, options);
        options.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    options.variable = variable;
    context = findAssignmentValue(variable, lang, tree) || findVarDeclaratorValue(variable, lang, tree);
    return content.slice(0, context.startIndex) +  value + content.slice(context.endIndex );
}

const appendValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(lang, tree, options);
        options.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(lang, tree, options);
        options.bound = {start: context.startPosition.row, end: context.endPosition.row};
    }
    options.variable = variable;
    context = findAssignmentValue(variable, lang, tree) || findVarDeclaratorValue(variable, lang, tree);
    if (context.type === "array") {
        context = context.lastChild;
        return content.slice(0, context.startIndex) + ", " + value + content.slice(context.startIndex);
    }
    return content;

}

module.exports = { parseFile, writeString, writeLines, getLine, addLine, setValue, getValue, appendValue, addImport };

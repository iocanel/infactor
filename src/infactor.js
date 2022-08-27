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

const queryNode = (name, lang, tree, queryFunction, bound) => {
    const { Query, QueryCursor } = require('tree-sitter');
    const query = new Query(lang, queryFunction(name));
    const matches = query.matches(tree.rootNode);
    let min = bound && bound.lower ? bound.lower : tree.rootNode.startPosition.row;
    let max = bound && bound.upper ? bound.upper : tree.rootNode.endPosition.row;
    var nodes = matches.flatMap(m => m.captures.filter(c => c.name === "target" && c.node.startPosition.row >= min && c.node.endPosition.row <= max).map(c => c.node));
    return nodes[nodes.length - 1];
}

const displayNode = (node, indent = 0) => {
    console.log(' '.repeat(indent) + node);
    node.children && node.children.forEach(c => displayNode(c, indent + 2));
}

//Class
const createClassBodyQuery = (name) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${name}") body: (_) @target)`;
const createFirstItemOfClassQuery = (name) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${name}") body: (class_body . (_) @target))`;
const createLastItemOfClassQuery = (name) => `(class_declaration name: (identifier) @class_name (#match? @class_name "${name}") body: (class_body (_) @target .))`;

const findClassBody = (name, lang, tree) => queryNode(name, lang, tree, createClassBodyQuery);
const findFirstLineOfClsasDeclaration = (name, lang, tree) => queryNode(name, lang, tree, createFirstItemOfClassQuery);
const findLastLineOfClsasDeclaration = (name, lang, tree) => queryNode(name, lang, tree, createLastItemOfClassQuery);

//Method
const createMethodBodyQuery = (name) => `(method_declaration name: (identifier) @method_name (#match? @method_name "${name}") body: (_) @target )`;
const createFirstItemOfMethodQuery = (name) => `(method_declaration name: (identifier) @method_name (#match? @method_name "${name}") body: (block . (_) @target ))`;
const createLastItemOfMethodQuery = (name) => `(method_declaration name: (identifier) @method_name (#match? @method_name "${name}") body: (block (_) @target .))`;

const findMethodBody = (name, lang, tree) => queryNode(name, lang, tree, createMethodBodyQuery);
const findFirstLineOfMethod = (name, lang, tree) => queryNode(name, lang, tree, createFirstItemOfMethodQuery);
const findLastLineOfMethod = (name, lang, tree) => queryNode(name, lang, tree, createLastItemOfMethodQuery);

//Function
const createFunctionBodyQuery = (name) => `(function_declaration name: (identifier) @function_name (#match? @function_name "${name}") body: (_) @target)`;
const createFirstItemOfFunctionQuery = (name) => `(function_declaration name: (identifier) @function_name (#match? @function_name "${name}") body: (statement_block . (_) @target ) @outer)`;
const createLastItemOfFunctionQuery = (name) => `(function_declaration name: (identifier) @function_name (#match? @function_name "${name}") body: (statement_block (_) @target .) @outer)`;

const findFunctionBody = (name, lang, tree) => queryNode(name, lang, tree, createFunctionBodyQuery);
const findFirstLineOfFunction = (name, lang, tree) => queryNode(name, lang, tree, createFirstItemOfFunctionQuery);
const findLastLineOfFunction = (name, lang, tree) => queryNode(name, lang, tree, createLastItemOfFunctionQuery);

// Assignment
const createAssignmentQuery = (name) => `(assignment_expression left: (_) @var_name (#match? @var_name "${name}") right: (_) @target)`;
const findAssignmentValue = (name, lang, tree, bound) => queryNode(name, lang, tree, createAssignmentQuery, bound);

// Var Declaration
const createVarDeclaratorQuery = (name) => `(variable_declarator name: (_) @var_name (#match? @var_name "${name}") value: (_) @target)`;
const findVarDeclaratorValue = (name, lang, tree, bound) => queryNode(name, lang, tree, createVarDeclaratorQuery, bound);

const addImport = (newImport, file) => {
    var lines = readFileLines(file);
    var index = findLastLineMatching(lines, "^[ ]*import.*;$");
    lines.splice(index + 1, 0, "import " + newImport + ";");
    writeLines(file, lines);
}

const getLine = (file, expression, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    if (options.inClass) {
        context = findClassBody(options.inClass, lang, tree);
    }
    if (options.inFunction) {
        context = findFunctionBody(options.inFunction, lang, tree);
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
        context = findClassBody(options.inClass, lang, tree);
    }
    if (options.inFunction) {
        context = findFunctionBody(options.inFunction, lang, tree);
    }
    if (options.top) {
        return content.slice(0, context.firstChild.startIndex + 1) + "\n" + code + content.slice(context.firstChild.startIndex + 1);
    }
    return content.slice(0, context.lastChild.startIndex - 1) + "\n" + code + content.slice(context.lastChild.startIndex - 1);
}

const getValue = (file, variable, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    let bound;
    if (options.inClass) {
        context = findClassBody(options.inClass, lang, tree);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(options.inFunction, lang, tree, bound);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    context = findAssignmentValue(variable, lang, tree, bound) || findVarDeclaratorValue(variable, lang, tree, bound);
    return content.slice(context.startIndex, context.endIndex);
}

const setValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    let bound;
    if (options.inClass) {
        context = findClassBody(options.inClass, lang, tree);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(options.inFunction, lang, tree, bound);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    context = findAssignmentValue(variable, lang, tree, bound) || findVarDeclaratorValue(variable, lang, tree, bound);
    return content.slice(0, context.startIndex) +  value + content.slice(context.endIndex );
}

const appendValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let context = tree.rootNode;
    let bound;
    if (options.inClass) {
        context = findClassBody(options.inClass, lang, tree);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    if (options.inFunction) {
        context = findFunctionBody(options.inFunction, lang, tree, bound);
        bound = {lower: context.startPosition.row, upper: context.endPosition.row};
    }
    context = findAssignmentValue(variable, lang, tree, bound) || findVarDeclaratorValue(variable, lang, tree, bound);
    displayNode(context);
    if (context.type === "array") {
        context = context.lastChild;
        return content.slice(0, context.startIndex) + ", " + value + content.slice(context.startIndex);
    }
    return content;

}

module.exports = { parseFile, writeString, writeLines, getLine, addLine, setValue, getValue, appendValue, addImport };

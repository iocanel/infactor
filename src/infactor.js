const { readFileSync, createWriteStream } = require('fs');

const BY_LINE = /\r?\n/
const NON_SPACE_CHAR = /\S/
const getFileExtension = (file) => file.substring(file.lastIndexOf('.') + 1);
const readFile = (file) => readFileSync(file, 'utf-8');
const readFileLines = (file) => readFile(file).split(BY_LINE);

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

const getIndentSizeOfLine = (line) => {
    let result = line.search(NON_SPACE_CHAR);
    return result > 0 ? result : 0;
}

const getIndentSizeOfLineAtIndex = (lines, index) => {
    let previousIndentWidth = 0;
    let nextIndentWidth = 0;

    for (var prev = index - 1; prev > 0 && prev < lines.length; prev--) {
        let indentSize = lines[prev].search(NON_SPACE_CHAR);
        if (indentSize > 0) {
            previousIndentWidth = indentSize;
        }
    }

    for (var next = index;  next > 0 && next < lines.length; next++) {
        let indentSize = lines[next].search(NON_SPACE_CHAR);
        if (indentSize > 0) {
            previousIndentWidth = indentSize;
        }
    }

    //  Best on the following scientific explanation we always need the largest:
    //
    //   (target)
    //   (added expression)
    // (end tag)


    //
    //  (open bracket)
    //    (added expression)
    //    (target)
    //

    return Math.max(previousIndentWidth, nextIndentWidth);
}

const getIndentSizeOfLines = (lines) => {
    let sizes = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    // Let's find which is the most common indent size in the file.
    for (let i=0; i < lines.length - 1; i++) {
        currentIndent = getIndentSizeOfLine(lines[i]);
        nextIndent = getIndentSizeOfLine(lines[i + 1]);
        let size = Math.abs(nextIndent - currentIndent);
        if (size > 0 && size < sizes.length) {
            sizes[size]+=1;
        }
    }
    const max = Math.max(...sizes);
    return sizes.indexOf(max);
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
    let node = tree.rootNode;
    if (options.inClass) {
        node = findClassBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }

    if (options.inFunction) {
        node = findFunctionBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    } else if (options.inMethod) {
        node = findMethodBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }

    let lines = content.split(BY_LINE);
    if (!node) {
        return -1;
    }

    let startRow = options.bound && options.bound.start ? options.bound.start : tree.rootNode.startPosition.row;
    let endRow = options.bound && options.bound.end ? options.bound.end : tree.rootNode.endPosition.row;

    if (options.first) {
        // the actual index differs from the line number by one
        return 1 + startRow + findFirstLineMatching(lines.filter((line, index) => index >= startRow && index <= endRow), options.expression);
    } 

    return 1 + startRow + findLastLineMatching(lines.filter((line, index) => index >= startRow && index <= endRow), expression);
}

const addLine = (file, code, options) => {
    let { lang, content, tree } = parseFile(file);
    let node = tree.rootNode;
    let lines = content.split(BY_LINE);
    if (options.inClass) {
        node = findClassBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }

    if (options.inFunction) {
        node = findFunctionBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    } else if (options.inMethod) {
        node = findMethodBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }

    let startRow = options.bound && options.bound.start ? options.bound.start : tree.rootNode.startPosition.row;
    let endRow = options.bound && options.bound.end ? options.bound.end : tree.rootNode.endPosition.row;

    if (options.top) {
        let lineIndex = node.firstChild.startRow - 1;
        return content.slice(0, node.firstChild.startIndex + 1) + "\n" + getIndentSizeOfLineAtIndex(lines, index) + code + content.slice(node.firstChild.startIndex + 1);
    } else if (options.after) {
        let lineIndex = startRow + findLastLineMatching(lines.filter((line, index) => index >= startRow && index <= endRow), options.after);
        let matchedLine = lines[lineIndex];
        code = matchedLine.slice(0, getIndentSizeOfLineAtIndex(lines, lineIndex)) + code;
        lines.splice(lineIndex + 1, 0, code)
        return lines.join('\n');
    } else if (options.before) {
        let lineIndex = startRow + findLastLineMatching(lines.filter((line, index) => index >= startRow && index <= endRow), options.before);
        let matchedLine = lines[lineIndex];
        code = matchedLine.slice(0, getIndentSizeOfLineAtIndex(lines, lineIndex)) + code;
        lines.splice(lineIndex , 0, code)
        return lines.join('\n');
    }

    let lineIndex = node.lastChild.startRow - 2;
    return content.slice(0, node.lastChild.startIndex - 1) + "\n" + getIndentSizeOfLineAtIndex(lines, lineIndex) + code + content.slice(node.lastChild.startIndex - 1);
}

const getValue = (file, variable, options) => {
    let { lang, content, tree } = parseFile(file);
    let node = tree.rootNode;
    if (options.inClass) {
        node = findClassBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    if (options.inFunction) {
        node = findFunctionBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    } else if (options.inMethod) {
        node = findMethodBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    options.variable = variable;
    node = findAssignmentValue(lang, tree, options) || findVarDeclaratorValue(lang, tree, options);
    return content.slice(node.startIndex, node.endIndex);
}

const setValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let node = tree.rootNode;
    if (options.inClass) {
        node = findClassBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    if (options.inFunction) {
        node = findFunctionBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    } else if (options.inMethod) {
        node = findMethodBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    options.variable = variable;
    node = findAssignmentValue(lang, tree, options) || findVarDeclaratorValue(lang, tree, options);
    return content.slice(0, node.startIndex) +  value + content.slice(node.endIndex );
}

const appendValue = (file, variable, value, options) => {
    let { lang, content, tree } = parseFile(file);
    let node = tree.rootNode;
    if (options.inClass) {
        node = findClassBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    if (options.inFunction) {
        node = findFunctionBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    } else if (options.inMethod) {
        node = findMethodBody(lang, tree, options);
        options.bound = {start: node.startPosition.row, end: node.endPosition.row};
    }
    options.variable = variable;
    node = findAssignmentValue(variable, lang, tree) || findVarDeclaratorValue(variable, lang, tree);
    if (node.type === "array") {
        node = node.lastChild;
        return content.slice(0, node.startIndex) + ", " + value + content.slice(node.startIndex);
    }
    return content;

}

module.exports = { parseFile, writeString, writeLines, getIndentSizeOfLine, getIndentSizeOfLines, getLine, addLine, setValue, getValue, appendValue, addImport };

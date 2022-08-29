#! /usr/bin/env node

const { parseFile, writeString, addImport, addLine, getLine, setValue, getValue, appendValue } = require('./infactor');
const { Command } = require('commander');
const program = new Command();

program
    .name('infactor')
    .description('A simple inline code editor and refactoring tool to use from the command line.')
    .version('0.0.1');

program.command('add-import')
    .description('Adds an import to the code')
    .argument('<import>', 'The import to add')
    .argument('<file>', 'The file to add the import to')
    .option('--out', 'Write result to stdout instead of saving to the file')
    .action((newImport, file, options) => {
        var content = addImport(newImport, file);
        if (options.out) {
            console.log(content);
        } else {
            writeString(file, content);
        }
    });

program.command('get-line')
    .description('Get the last (or optionally the first) line that matches the expression')
    .argument('<file>', 'The file to add the import to')
    .argument('<expression>', 'The regular expression to use for matching')
    .option('--first', 'Flag to return the first line matching')
    .option('--in-class <class>', 'Search inside the specified class (e.g. function etc)')
    .option('--in-method <method>', 'Search inside the specified function (e.g. method etc)')
    .option('--in-function <function>', 'Search inside the specified function (e.g. function etc)')
    .action((file, expression, options) => {
        let { lang, content, tree } = parseFile(file);
        var result = getLine(file, expression, options);
        console.log(result > 0 ? result : -1);
    });

program.command('add-line')
    .description('Add a line at the bottom of the block')
    .argument('<file>', 'The file to add the import to')
    .argument('<code>', 'The code to add')
    .option('--out', 'Write result to stdout instead of saving to the file')
    .option('--top', 'Flag to enable adding the code at the top of the block')
    .option('--before <expression>', 'The expression to match the line before which the code will be added')
    .option('--after <expression>', 'The expression to match the line after which the code will be added')
    .option('--in-class <class>', 'Search inside the specified class (e.g. function etc)')
    .option('--in-method <method>', 'Search inside the specified function (e.g. method etc)')
    .option('--in-function <function>', 'Search inside the specified function (e.g. function etc)')
    .action((file, code, options) => {
        let content = addLine(file, code, options);
        if (options.out) {
            console.log(content);
        } else {
            writeString(file, content);
        }
    });

program.command('get')
    .description('Get the value of a variable')
    .argument('<file>', 'The file to add the import to')
    .argument('<variable>', 'The variable to set')
    .option('--in-class <class>', 'Search inside the specified class (e.g. function etc)')
    .option('--in-method <method>', 'Search inside the specified function (e.g. method etc)')
    .option('--in-function <function>', 'Search inside the specified function (e.g. function etc)')
    .action((file, variable,  options) => {
        let content = getValue(file, variable, options);
        console.log(content);
    });

program.command('set')
    .description('Set the value of a variable')
    .argument('<file>', 'The file to add the import to')
    .argument('<variable>', 'The variable to set')
    .argument('<value>', 'The value to set')
    .option('--out', 'Write result to stdout instead of saving to the file')
    .option('--in-class <class>', 'Search inside the specified class (e.g. function etc)')
    .option('--in-method <method>', 'Search inside the specified function (e.g. method etc)')
    .option('--in-function <function>', 'Search inside the specified function (e.g. function etc)')
    .action((file, variable, value, options) => {
        let content = setValue(file, variable, value, options);
        if (options.out) {
            console.log(content);
        } else {
            writeString(file, content);
        }
        writeString(file, content);
    });

program.command('append')
    .description('Append the value to a variable (e.g. array)')
    .argument('<file>', 'The file to add the import to')
    .argument('<variable>', 'The variable to append to')
    .argument('<value>', 'The value to append')
    .option('--out', 'Write result to stdout instead of saving to the file')
    .option('--in-class <class>', 'Search inside the specified class (e.g. function etc)')
    .option('--in-method <method>', 'Search inside the specified function (e.g. method etc)')
    .option('--in-function <function>', 'Search inside the specified function (e.g. function etc)')
    .action((file, variable, value, options) => {
        let content = appendValue(file, variable, value, options);
        if (options.out) {
            console.log(content);
        } else {
            writeString(file, content);
        }
    });

program.parse();

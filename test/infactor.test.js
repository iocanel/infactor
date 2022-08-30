const chai = require("chai");
const { getIndentSizeOfLine, getIndentSizeOfLines, getLine } = require("../src/infactor");

var assert = chai.assert;
describe('infactor', function() {
    it("should get indent size of line" , () => {
        assert.equal(0, getIndentSizeOfLine(''));
        assert.equal(0, getIndentSizeOfLine('no spaces'));
        assert.equal(2, getIndentSizeOfLine('  two spaces'));
        assert.equal(4, getIndentSizeOfLine('    four spaces'));
        assert.equal(8, getIndentSizeOfLine('        eight spaces'));
    });

    it("should get indent size of lines" , () => {
        assert.equal(2, getIndentSizeOfLines([
            'fun withTwo() {',
            '  console.log("two spaces");',
            '}']));

        assert.equal(2, getIndentSizeOfLines([
            '  fun withTwo() {',
            '    console.log("two spaces");',
            '  }']));

        assert.equal(4, getIndentSizeOfLines([
            '    fun withFour() {',
            '        console.log("four spaces");',
            '    }']));
    });


    it("should add import", () => {
    });

    it("should get line", () => {
        let result = getLine("sample.js", "^[ ]*console", {});
        assert.equal(result, 35);

        result = getLine("sample.js", "^[ ]*console", {first: true});
        assert.equal(result, 1);

        result = getLine("sample.js", "^[ ]*console", {inClass: "Op"});
        assert.equal(result, 12);

        result = getLine("sample.js", "var a", {inFunction: "demo", first: true});
        assert.equal(result, 26);
    });

    it("should add line", () => {
    });
});

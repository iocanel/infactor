const chai = require("chai");
const { getLine } = require("../src/infactor");

var assert = chai.assert;
describe('infactor', function() {
    it("should add import", () => {
    });

    it("should get line", () => {
        let result = getLine("sample.js", "^[ ]*console", {});
        assert.equal(result, 35);

        result = getLine("sample.js", "^[ ]*console", {first: true});
        assert.equal(result, 1);

        result = getLine("sample.js", "^[ ]*console", {inClass: "Op"});
        assert.equal(result, 12);
    });

    it("should add line", () => {
    });
});

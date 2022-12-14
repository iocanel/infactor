console.log("demo");

class Op {
    constructor(a, b, func) {
        this.a = a;
        this.b = b;
        this.func = func;
    }

    exec() {
        let result = this.func(this.a, this.b);
        console.log(this.func.name + "(" + this.a + ", " + this.b + ") = " + result);
    }
}

function sum (a, b) {
    return a + b;
}


function mul (a, b) {
    return a * b;
}

function demo () {
    var a = 2;
    var b = 3;
    var array = [1, 2, 3, 4, 5];
    new Op(a, b, sum).exec();
    new Op(a, b, mul).exec();
}

demo();

console.log("done");

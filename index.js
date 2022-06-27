const str = '2 + (4*4)  * ROUND(2 * ROUND(3 * DEJ("123"), 5), 1) + IF(2 = 2 , 33, 345)';
//    number 正数 负数 小数  /\d/ 数
//    paren ( )  /[()]/  括号
//    sign + - * / ^ 运算符
//    constant 常量  π
//    variable 字面量如 "23" "dddd"
//        identifier 标识符 如ROUND
//
const PI = 'π'

/**
 *
 * @param str {string}
 */
function runCodeStr(str) {
    const ROUND = (value, dic) => {
        return Number(value).toFixed(dic);
    }

    const DEJ = (value) => {
        return 123
    }

    const sandBox = new Proxy({ROUND, DEJ, [PI]: Math.PI}, {
        has() {
            return true
        }
    })

    const fun = new Function('sandBox', `with(sandBox) { return ${str} }`);

    try {
        return fun(sandBox);
    } catch (e) {
        console.log(e)
        return 0
    }
}

// console.log(runCodeStr('ROUND(π, 3)'));


const NUMBER_REGEX = /\d/
const PAREN_REGEX = /[()]/
const SIGN_REGEX = /[+\-*/^=]/

const VARIABLE_REGEX = /["']/
// constant
const constantMap = {}

class Lexer {

    constructor() {
        this.state = this.start;
        this.tokens = [];
        this.token = '';
        this.lastMatch = '';
    }

    /**
     *
     * @param s {string}
     */
    start(s) {

        if (SIGN_REGEX.test(s)) {
            this.emitToken('sign', s)
            return this.start;
        }

        if (NUMBER_REGEX.test(s)) {
            this.token = s;
            this.type = 'number'
            return this.inInt;
        }

        if (PAREN_REGEX.test(s)) {
            this.emitToken('paren', s)
            return this.start;
        }


        if (VARIABLE_REGEX.test(s)) {
            this.lastMatch = s;
            this.token = s;
            this.type = 'variable';
            return this.inVariable;
        }

        if (s === PI) {
            this.emitToken('constant', s);
            return this.start
        }

        if (/\s/.test(s)) {
            return this.start
        }

        if (/[a-z_$]/i.test(s)) {
            this.token = s;
            this.type = 'identifier';
            return this.inCharStr
        }
        if (/,/i.test(s)) {
            this.emitToken('paramSplit', s)
            return this.start
        }
        throw Error('错误')
    }

    inInt(s) {
        if (NUMBER_REGEX.test(s)) {
            this.token += s;
            return this.inInt;
        }

        if (/\./.test(s)) {
            this.token += s;
            return this.inFloat;
        }

        this.emitToken('number', this.token);
        this.token = '';
        this.type = '';
        return this.start(s)
    }

    inFloat(s) {
        if (NUMBER_REGEX.test(s)) {
            this.token += s;
            return this.inFloat;
        }
        if (s === '.') {
            throw Error('不能同时出现 1.1.1')
        }
        if (this.token[this.token.length - 1] === '.') {
            throw Error('不能同时出现 ..')
        }

        this.emitToken('number', this.token);
        return this.start(s)
    }

    inVariable(s) {
        if (s === this.lastMatch) {
            this.token += s;
            this.emitToken('variable', this.token);
            this.token = '';
            this.type = ''
            return this.start
        }
        this.token += s;
        return this.inVariable
    }

    inCharStr(s) {
        if (/[a-z\d$_]/i.test(s)) {
            this.token += s;
            return this.inCharStr
        }
        this.emitToken(this.type, this.token);
        this.type = '';
        this.token = '';
        return this.start(s)
    }

    /**
     * @param char {string}
     */
    push(char) {
        this.state = this.state(char);
        return this.emit()
    }

    emitToken(type, value) {
        this.tokens.push({type, value})
    }

    end() {
        if (this.token) {
            // 可以判断数字和
            this.emitToken(this.type, this.token);
        }
        return this.emit()
    }

    emit() {
        const _token = [...this.tokens]
        this.tokens = [];
        return _token
    }

}

const l = new Lexer();
const tokens = [];
for (const s of str) {
    tokens.push(...l.push(s))
}
tokens.push(...l.end())

const exampleAST = {
    type: 'Program',
    body: [
        {
            type: 'NumberLiteral',
            value: '2'
        },

    ]
}

const regexFunc = /ROUND|IF|DEJ|DEJ_MX/;

/**
 *
 * @param tokens {Array<{type: "number"|"paren"|"sign"|"constant"|"variable"|"identifier", value: string}>}
 * ""
 */
function parse(tokens) {
    const ast = {
        type: 'ExpressionStatement',
        body: []
    };
    const bracketNode = [];
    let currIndex = 0;
    let currPoint = ast.body;

    const pushParam = () => {
        const index = currPoint.findIndex(i => i.type !== 'ExpressionStatement');
        const nodeList = currPoint.slice(index);
        let param;
        if (nodeList.length) {
            if (nodeList.length > 1) {
                param = {type: 'ExpressionStatement', body: nodeList};
            } else {
                param = nodeList[0];
            }
        } else {
            param = {type: 'null', value: null}
        }
        currPoint.splice(index, nodeList.length, param);
    }

    const paramFactory = () => {
        const param = [];
        let nodes = [];
        for (const nodeParam of currPoint) {
            if (nodeParam.type === 'paramSplit') {
                if (nodes.length > 1) {
                    param.push({type: 'ExpressionStatement', body: nodes});
                } else {
                    param.push(nodes[0]);
                }
                nodes = [];
                continue
            }
            nodes.push(nodeParam)
        }
        if (nodes.length > 1) {
            param.push({type: 'ExpressionStatement', body: nodes});
        } else {
            param.push(nodes[0]);
        }
        return param
    }
    /**
     *
     * @param node {{type: "number"|"paren"|"sign"|"constant"|"variable"|"identifier", value: string}}
     */
    const walk = node => {
        switch (node.type) {
            case "number": // 数字
                return {type: 'NumberLiteral', value: node.value}
            case "sign":  // 符号

                return {type: "Paren", value: node.value === '=' ? '===' : node.value}
            case "constant":  // 常量
                return {type: "Constant", value: node.value}
            case "paren":
                if (node.value === '(') {
                    // 开始
                    let currTrackNode;
                    const lastToken = tokens[currIndex - 1];
                    if (!lastToken || lastToken.type !== 'identifier') {
                        currTrackNode = {type: 'ExpressionStatement', body: []};
                        currPoint.push(currTrackNode);
                        currPoint = currTrackNode.body;
                    } else {
                        currTrackNode = currPoint[currPoint.length - 1];
                        currPoint = currTrackNode.param;
                    }
                    bracketNode.push(currTrackNode);
                } else {
                    // 结束
                    const lastNode = bracketNode[bracketNode.length - 1];
                    if (!lastNode) {
                        throw Error('错误: "("和")"无匹配');
                    }
                    bracketNode.pop();
                    if (lastNode.type === 'CallExpression') {
                        lastNode.param = paramFactory();
                    }
                    const nextNode = bracketNode[bracketNode.length - 1];
                    if (nextNode) {
                        currPoint = nextNode.type === 'ExpressionStatement' ? nextNode.body : nextNode.param;
                    } else {
                        currPoint = ast.body;
                    }
                }
                break
            case "variable":  // 变量
                return {type: "Variable", value: node.value}
            case "identifier":
                return {type: "CallExpression", value: node.value, param: []};
            // paramSplit
            default:
                //
                let lastBracketNode = bracketNode[bracketNode.length - 1];
                //  确保为函数
                if (!lastBracketNode || lastBracketNode.type !== 'CallExpression') {
                    throw Error(',')
                }
                // pushParam()
                if (currPoint[currPoint.length - 1] && currPoint[currPoint.length - 1].type === 'paramSplit') {
                    currPoint.push({type: 'null', value: null});
                }
                currPoint.push(node);
            // 压入参数
            // 接受下一组参数
        }
    }

    while (currIndex < tokens.length) {
        const node = walk(tokens[currIndex]);
        if (node) {
            currPoint.push(node)
        }
        currIndex++;
    }

    return ast
}

function toJavaScript(ast) {

}

class VerifyGrammar {

}

const verifyTools = {
    numberType: 'number',
    booleanType: 'boolean',
    variableType: 'variable',
    typeZhCnMap: {
        number: '数字',
        boolean: '等式',
        variable: '变量'
    },
    // 函数规则
    callRules: {
        IF: {
            param: [
                "boolean",
                "number",
                "number"
            ],
            return: 'number'
        },
        DEJ: {
            param: [
                "variable"
            ],
            return: 'number'
        },
        DEJ_MX: {
            param: [
                "variable",
                "variable"
            ],
            return: 'number'
        },
        ROUND: {
            param: [
                "number",
                "number"
            ],
            return: "number"
        }
    },
    //
    constantRules: {
        [PI]: 'number'
    },
    isNumber(node) {
        const numberType = 'number';
        if (node.type === 'NumberLiteral') return true;
        if (node.type === 'Constant' && this.constantRules[node.value] === numberType) {
            return true
        }
        if (node.type === 'CallExpression' && this.isCall(node) && this.callRules[node.value].return === 'number') {
            return true
        }
        if (node.type === 'ExpressionStatement' && this.isExpression(node)) {
            return true
        }
        // console.log(`${node.value} 不为数字！`);
        return false
    },
    isEqual(node) {
        if (node.type === 'ExpressionStatement') {
            let nodes = node.body;
            if (nodes.length !== 3 || nodes[1].value !== '===') {
                // throw Error('等式格式错误！')
                console.log('等式格式错误！');
                return false
            }
            return this.isNumber(nodes[0]) && this.isNumber(nodes[2])
        } else if (node.type === 'CallExpression') {

        }

    },
    isCall(node) {
        const call = this.callRules[node.value];
        if (!call) {
            // throw Error(`无 ${node.value} 函数`)
            console.log(`无 ${node.value} 函数`);
            return false
        }
        if (call.param.length !== node.param.length) {
            // throw Error(`${node.value} 缺少参数`)
            console.log(`函数${node.value}参数个数错误`);
            return false
        }
        for (let i = 0; i < call.param.length; i++) {
            console.log(node.param[i], call.param[i])
            if (!node.param[i] || node.param[i].type === 'null' || !this.verifyNode(node.param[i], call.param[i])) {
                // throw Error(`参数 ${node.value} 类型错误，应为 ${this.typeZhCnMap[call.param[i].return]}`)
                console.log(`${node.value}函数：第${i + 1}个参数类型错误，应为${this.typeZhCnMap[call.param[i]]}类型`);
                return false
            }
        }
        return true
    },
    isExpression(node) {
        const body = node.body;
        if (body.length % 2 !== 1) {
            // throw Error('表达式错误！')
            console.log('表达式错误！');
            return false
        }
        if (!this.isNumber(body[0])) {
            return false
        }
        for (let i = 1; i <= body.length - 2; i += 2) {
            if (!this.isParen(body[i]) || !this.isNumber(body[i + 1])) {
                return false
            }
        }
        return true
    },
    isParen(node) {
        return node.type === 'Paren' && node.value !== '==='
    },
    isVariable(node) {
        return node.type === 'Variable'
    },
    verifyNode(node, typeStr) {
        switch (typeStr) {
            case this.numberType:
                return this.isNumber(node);
            case this.variableType:
                return this.isVariable(node);
            case this.booleanType:
                return this.isEqual(node);
            default:
                return false
        }
    }
}


// const ast = parse(tokens);
//
// console.log(verifyTools.isExpression(ast), ast, str);


const runExcelCode = (str) => {

    const l = new Lexer();
    const tokens = [];

    for (const s of str) {
        tokens.push(...l.push(s))
    }

    tokens.push(...l.end())

    const ast = parse(tokens);

    const isTrue = verifyTools.isExpression(ast)

    console.log(isTrue);

}


runExcelCode('1 + 23 +ROUND(3, 1) + DEJ("123") + IF(1 = 2, 2, 3)')





























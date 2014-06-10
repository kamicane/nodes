'use strict';

var s = require('../syntax.json');

var typeOf = require('./type-of');
var factory = require('./factory');

var Node = factory.Node;
var List = factory.List;

// # type checks

var string = { test: typeOf.String };
var boolean = { test: typeOf.Boolean };
var number = { test: typeOf.Number };
var regexp = { test: typeOf.RegExp };

var expect = factory.expect;

var describe = function(SuperNode, description) {
  return nodes[description.type] = factory.describe(SuperNode, description);
};

// # Statement

var Statement = describe(Node, {
  type: 'Statement'
});

// # Program

var Program = describe(Node, {
  type: s.Program,
  body: [ Statement ]
});

// # EmptyStatement

var EmptyStatement = describe(Statement, {
  type: s.EmptyStatement
});

// # BlockStatement

var BlockStatement = describe(Statement, {
  type: s.BlockStatement,
  body: [ Statement ]
});

// # Expression

var Expression = describe(Node, {
  type: 'Expression'
});

// # ExpressionStatement

var ExpressionStatement = describe(Statement, {
  type: s.ExpressionStatement,
  expression: Expression
});

// # Identifier

var Identifier = describe(Expression, {
  type: s.Identifier,
  name: string
});

// # Pattern

var Pattern = nodes.Pattern =  { test: function(item) {
  return item instanceof Identifier ||
         item instanceof ArrayPattern ||
         item instanceof ObjectPattern;
} };

// # ArrayPattern

var ArrayPattern = describe(Node, {
  type: s.ArrayPattern,
  elements: [ Pattern, null ]
});

// # Literal

var Literal = describe(Expression, {
  type: s.Literal,
  value: expect(string, boolean, null, number, regexp)
});

// # Property

var Property = describe(Node, {
  type: s.Property,
  key: expect(Literal, Identifier),
  value: expect(Pattern, Expression),
  kind: /^(init|get|set)$/,
  shorthand: boolean,
  method: boolean
});

// # ObjectPattern

var ObjectPattern = describe(Node, {
  type: s.ObjectPattern,
  properties: [ Property, { test: function(item) {
    return Pattern.test(item.value);
  } } ]
});

// # Declaration

var Declaration = describe(Statement, {
  type: 'Declaration'
});

// # VariableDeclarator

var VariableDeclarator = describe(Node, {
  type: s.VariableDeclarator,
  id: Pattern,
  init: expect(Expression, null)
});

// # VariableDeclaration

var VariableDeclaration = describe(Declaration, {
  type: s.VariableDeclaration,
  declarations: [ VariableDeclarator ],
  kind: /^(var|let|const)$/,
});

// # FunctionDeclaration

var FunctionDeclaration = describe(Declaration, {
  type: s.FunctionDeclaration,
  id: expect(Identifier, null),
  params: [ Pattern ],
  defaults: [ Expression ],
  rest: expect(Identifier, null),
  body: expect(BlockStatement, Expression),
  generator: boolean,
  expression: boolean
});

// # FunctionExpression

var FunctionExpression = describe(Expression, {
  type: s.FunctionExpression,
  id: expect(Identifier, null),
  params: [ Pattern ],
  defaults: [ Expression ],
  rest: expect(Identifier, null),
  body: expect(BlockStatement, Expression),
  generator: boolean,
  expression: boolean
});

// # CallExpression

var CallExpression = describe(Expression, {
  type: s.CallExpression,
  callee: Expression,
  arguments: [ Expression ]
});

// # MemberExpression

var MemberExpression = describe(Expression, {
  type: s.MemberExpression,
  object: Expression,
  property: expect(Identifier, Expression),
  computed: boolean
});

// # UnaryExpression

var UnaryOperator = /^(\-|\+|\!|\~|typeof|void|delete)$/;

var UnaryExpression = describe(Expression, {
  type: s.UnaryExpression,
  operator: UnaryOperator,
  prefix: boolean,
  argument: Expression
});

// # IfStatement

var IfStatement = describe(Statement, {
  type: s.IfStatement,
  test: Expression,
  consequent: Statement,
  alternate: expect(Statement, null)
});

// # BinaryExpression

var BinaryOperator = /^(==|!=|===|!==|<|<=|>|>=|<<|>>|>>>|\+|-|\*|\/|\%|\||\^|\&|in|instanceof|\.\.)$/;

var BinaryExpression = describe(Expression, {
  type: s.BinaryExpression,
  operator: BinaryOperator,
  left: Expression,
  right: Expression
});

// # ReturnStatement

var ReturnStatement = describe(Statement, {
  type: s.ReturnStatement,
  argument: expect(Expression, null)
});

// # AssignmentExpression

var AssignmentOperator = /^(=|\+=|-=|\*|\/=|%=|<<=|>>=|>>>=|\|=|\^=|&=)$/;

var AssignmentExpression = describe(Expression, {
  type: s.AssignmentExpression,
  operator: AssignmentOperator,
  left: Expression,
  right: Expression
});

// # ForStatement

var ForStatement = describe(Statement, {
  type: s.ForStatement,
  init: expect(VariableDeclaration, Expression, null),
  test: expect(Expression, null),
  update: expect(Expression, null),
  body: Statement
});

// # UpdateExpression

var UpdateOperator = /^(\+\+|--)$/;

var UpdateExpression = describe(Expression, {
  type: s.UpdateExpression,
  operator: UpdateOperator,
  argument: Expression,
  prefix: boolean
});

// # ThisExpression

var ThisExpression = describe(Expression, {
  type: s.ThisExpression,
});

// # ArrayExpression

var ArrayExpression = describe(Expression, {
  type: s.ArrayExpression,
  elements: [ Expression, null ]
});

// # ObjectExpression

var ObjectExpression = describe(Expression, {
  type: s.ObjectExpression,
  properties: [ Property ]
});

// # SequenceExpression

var SequenceExpression = describe(Expression, {
  type: s.SequenceExpression,
  expressions: [ Expression ]
});

// # ThrowStatement

var ThrowStatement = describe(Statement, {
  type: s.ThrowStatement,
  argument: Expression
});

// # CatchClause

var CatchClause = describe(Node, {
  type: s.CatchClause,
  param: Pattern,
  guard: expect(Expression, null),
  body: BlockStatement
});

// # WhileStatement

var WhileStatement = describe(Statement, {
  type: s.WhileStatement,
  test: Expression,
  body: Statement
});

// # NewExpression

var NewExpression = describe(Expression, {
  type: s.NewExpression,
  callee: Expression,
  arguments: [ Expression ]
});

// # LogicalExpression

var LogicalOperator = /^(\|\||&&)$/;

var LogicalExpression = describe(Expression, {
  type: s.LogicalExpression,
  operator: LogicalOperator,
  left: Expression,
  right: Expression
});

// #

var ConditionalExpression = describe(Expression, {
  type: s.ConditionalExpression,
  test: Expression,
  alternate: Expression,
  consequent: Expression
});

// #

var ForInStatement = describe(Statement, {
  type: s.ForInStatement,
  left: expect(VariableDeclaration, Expression),
  right: Expression,
  body: Statement,
  each: boolean
});

// #

var ContinueStatement = describe(Statement, {
  type: s.ContinueStatement,
  label: expect(Identifier, null)
});

// #

var DoWhileStatement = describe(Statement, {
  type: s.DoWhileStatement,
  body: Statement,
  test: Expression
});

// #

var BreakStatement = describe(Statement, {
  type: s.BreakStatement,
  label: expect(Identifier, null)
});

// #

var SwitchCase = describe(Node, {
  type: s.SwitchCase,
  test: expect(Expression, null),
  consequent: [ Statement ]
});

// #

var SwitchStatement = describe(Statement, {
  type: s.SwitchStatement,
  discriminant: Expression,
  cases: [ SwitchCase ],
  lexical: boolean
});

// #

var ComprehensionBlock = describe(Node, {
  type: s.ComprehensionBlock,
  left: Pattern,
  right: Expression,
  each: boolean
});

// #

var YieldExpression = describe(Expression, {
  type: s.YieldExpression,
  argument: expect(Expression, null)
});

// #

var ComprehensionExpression = describe(Expression, {
  type: s.ComprehensionExpression,
  body: Expression,
  blocks: [ ComprehensionBlock ],
  filter: expect(Expression, null)
});

// #

var TryStatement = describe(Statement, {
  type: s.TryStatement,
  block: BlockStatement,
  handler: expect(CatchClause, null),
  guardedHandlers: [ CatchClause ],
  finalizer: expect(BlockStatement, null)
});

// #

var LabeledStatement = describe(Statement, {
  type: s.LabeledStatement,
  label: Identifier,
  body: Statement
});

// #

var ForOfStatement = describe(Statement, {
  type: s.ForOfStatement,
  left: expect(VariableDeclaration, Expression),
  right: Expression,
  body: Statement
});

// #

var WithStatement = describe(Statement, {
  type: s.WithStatement,
  object: Expression,
  body: Statement
});

// #

var DebuggerStatement = describe(Statement, {
  type: s.DebuggerStatement
});

// #

var ArrowFunctionExpression = describe(Expression, {
  type: s.ArrowFunctionExpression,
  params: [ Pattern ],
  defaults: [ Expression ],
  rest: expect(Identifier, null),
  body: expect(BlockStatement, Expression),
  expression: boolean
});

// # Function

var Function = nodes.Function = { test: function(item) {
  return item instanceof FunctionExpression ||
         item instanceof FunctionDeclaration ||
         item instanceof ArrowFunctionExpression;
} };

// # from esprima#harmony

// "ClassBody", "ClassDeclaration", "ClassExpression", "MethodDefinition",
// "ExportDeclaration", "ExportBatchSpecifier", "ExportSpecifier",
// "ImportDeclaration", "ImportSpecifier", "ModuleDeclaration",
// "SpreadElement",
// "TaggedTemplateExpression", "TemplateElement", "TemplateLiteral"

var SpreadElement = describe(Expression, {
  type: s.SpreadElement,
  argument: Expression
});

// var missing = [];

// for (var key in s) if (!(key in nodes)) missing.push(key);
// console.warn('missing', missing);

// # build

function nodes(ast) {
  if (ast == null) return null;

  var type = ast.type;

  var NodeClass = nodes[type];
  if (!NodeClass) throw new Error(type + ' is missing');

  var node = new NodeClass;

  var keys = NodeClass.keys;

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (key === 'type') continue;

    var value = ast[key];

    switch(typeOf(value)) {
      case 'Object':
        node[key] = nodes(value);
        break;
      case 'Array':
        var list = node[key];
        for (var j = 0; j < value.length; j++) list.push(nodes(value[j]));
        break;
      case 'Undefined': break;
      default: node[key] = value;
    }
  }

  return node;
}

nodes.Node = Node;
nodes.List = List;

module.exports = nodes;

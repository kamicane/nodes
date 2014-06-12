'use strict';

var syntax = require('./syntax.json');

var typeOf = require('./util/type-of');
var factory = require('./lib/factory');

var Node = factory.Node;

// # type checks

var string = { test: typeOf.String };
var boolean = { test: typeOf.Boolean };
var number = { test: typeOf.Number };
var regexp = { test: typeOf.RegExp };

var expect = factory.expect;
var types = factory.types;
var describe = factory.describe;

// # Statement

var Statement = describe(Node, {
  type: 'Statement'
});

// # Program

var Program = describe(Node, {
  type: syntax.Program,
  body: [ Statement ]
});

// # EmptyStatement

var EmptyStatement = describe(Statement, {
  type: syntax.EmptyStatement
});

// # BlockStatement

var BlockStatement = describe(Statement, {
  type: syntax.BlockStatement,
  body: [ Statement ]
});

// # Expression

var Expression = describe(Node, {
  type: 'Expression'
});

// # ExpressionStatement

var ExpressionStatement = describe(Statement, {
  type: syntax.ExpressionStatement,
  expression: Expression
});

// # Identifier

var Identifier = describe(Expression, {
  type: syntax.Identifier,
  name: string
});

// # Pattern

var Pattern = types.Pattern =  { test: function(item) {
  return item instanceof Identifier ||
         item instanceof ArrayPattern ||
         item instanceof ObjectPattern;
} };

// # ArrayPattern

var ArrayPattern = describe(Node, {
  type: syntax.ArrayPattern,
  elements: [ Pattern, null ]
});

// # Literal

var Literal = describe(Expression, {
  type: syntax.Literal,
  value: expect(string, boolean, null, number, regexp)
});

// # Property

var Property = describe(Node, {
  type: syntax.Property,
  key: expect(Literal, Identifier),
  value: expect(Pattern, Expression),
  kind: /^(init|get|set)$/,
  shorthand: expect(boolean).default(false),
  method: expect(boolean).default(false)
});

// # ObjectPattern

var ObjectPattern = describe(Node, {
  type: syntax.ObjectPattern,
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
  type: syntax.VariableDeclarator,
  id: Pattern,
  init: expect(Expression, null).default(null)
});

// # VariableDeclaration

var VariableDeclaration = describe(Declaration, {
  type: syntax.VariableDeclaration,
  declarations: [ VariableDeclarator ],
  kind: expect(/^(var|let|const)$/).default('var')
});

// # FunctionDeclaration

var FunctionDeclaration = describe(Declaration, {
  type: syntax.FunctionDeclaration,
  id: expect(Identifier, null).default(null),
  params: [ Pattern ],
  defaults: [ Expression, null ],
  rest: expect(Identifier, null).default(null),
  body: expect(BlockStatement, Expression),
  generator: expect(boolean).default(false),
  expression: expect(boolean).default(false)
});

// # FunctionExpression

var FunctionExpression = describe(Expression, {
  type: syntax.FunctionExpression,
  id: expect(Identifier, null).default(null),
  params: [ Pattern ],
  defaults: [ Expression, null ],
  rest: expect(Identifier, null).default(null),
  body: expect(BlockStatement, Expression),
  generator: expect(boolean).default(false),
  expression: expect(boolean).default(false)
});

// # CallExpression

var CallExpression = describe(Expression, {
  type: syntax.CallExpression,
  callee: Expression,
  arguments: [ Expression ]
});

// # MemberExpression

var MemberExpression = describe(Expression, {
  type: syntax.MemberExpression,
  object: Expression,
  property: expect(Identifier, Expression),
  computed: expect(boolean).default(false)
});

// # UnaryExpression

var UnaryOperator = /^(\-|\+|\!|\~|typeof|void|delete)$/;

var UnaryExpression = describe(Expression, {
  type: syntax.UnaryExpression,
  operator: UnaryOperator,
  prefix: boolean,
  argument: Expression
});

// # IfStatement

var IfStatement = describe(Statement, {
  type: syntax.IfStatement,
  test: Expression,
  consequent: Statement,
  alternate: expect(Statement, null).default(null)
});

// # BinaryExpression

var BinaryOperator = /^(==|!=|===|!==|<|<=|>|>=|<<|>>|>>>|\+|-|\*|\/|\%|\||\^|\&|in|instanceof|\.\.)$/;

var BinaryExpression = describe(Expression, {
  type: syntax.BinaryExpression,
  operator: BinaryOperator,
  left: Expression,
  right: Expression
});

// # ReturnStatement

var ReturnStatement = describe(Statement, {
  type: syntax.ReturnStatement,
  argument: expect(Expression, null).default(null)
});

// # AssignmentExpression

var AssignmentOperator = /^(=|\+=|-=|\*|\/=|%=|<<=|>>=|>>>=|\|=|\^=|&=)$/;

var AssignmentExpression = describe(Expression, {
  type: syntax.AssignmentExpression,
  operator: AssignmentOperator,
  left: Pattern,
  right: Expression
});

// # ForStatement

var ForStatement = describe(Statement, {
  type: syntax.ForStatement,
  init: expect(VariableDeclaration, Expression, null).default(null),
  test: expect(Expression, null).default(null),
  update: expect(Expression, null).default(null),
  body: Statement
});

// # UpdateExpression

var UpdateOperator = /^(\+\+|--)$/;

var UpdateExpression = describe(Expression, {
  type: syntax.UpdateExpression,
  operator: UpdateOperator,
  argument: Expression,
  prefix: boolean
});

// # ThisExpression

var ThisExpression = describe(Expression, {
  type: syntax.ThisExpression,
});

// # ArrayExpression

var ArrayExpression = describe(Expression, {
  type: syntax.ArrayExpression,
  elements: [ Expression, null ]
});

// # ObjectExpression

var ObjectExpression = describe(Expression, {
  type: syntax.ObjectExpression,
  properties: [ Property ]
});

// # SequenceExpression

var SequenceExpression = describe(Expression, {
  type: syntax.SequenceExpression,
  expressions: [ Expression ]
});

// # ThrowStatement

var ThrowStatement = describe(Statement, {
  type: syntax.ThrowStatement,
  argument: Expression
});

// # CatchClause

var CatchClause = describe(Node, {
  type: syntax.CatchClause,
  param: Pattern,
  guard: expect(Expression, null),
  body: BlockStatement
});

// # WhileStatement

var WhileStatement = describe(Statement, {
  type: syntax.WhileStatement,
  test: Expression,
  body: Statement
});

// # NewExpression

var NewExpression = describe(Expression, {
  type: syntax.NewExpression,
  callee: Expression,
  arguments: [ Expression ]
});

// # LogicalExpression

var LogicalOperator = /^(\|\||&&)$/;

var LogicalExpression = describe(Expression, {
  type: syntax.LogicalExpression,
  operator: LogicalOperator,
  left: Expression,
  right: Expression
});

// #

var ConditionalExpression = describe(Expression, {
  type: syntax.ConditionalExpression,
  test: Expression,
  alternate: Expression,
  consequent: Expression
});

// #

var ForInStatement = describe(Statement, {
  type: syntax.ForInStatement,
  left: expect(VariableDeclaration, Expression),
  right: Expression,
  body: Statement,
  each: expect(boolean).default(false)
});

// #

var ContinueStatement = describe(Statement, {
  type: syntax.ContinueStatement,
  label: expect(Identifier, null).default(null)
});

// #

var DoWhileStatement = describe(Statement, {
  type: syntax.DoWhileStatement,
  body: Statement,
  test: Expression
});

// #

var BreakStatement = describe(Statement, {
  type: syntax.BreakStatement,
  label: expect(Identifier, null).default(null)
});

// #

var SwitchCase = describe(Node, {
  type: syntax.SwitchCase,
  test: expect(Expression, null).default(null),
  consequent: [ Statement ]
});

// #

var SwitchStatement = describe(Statement, {
  type: syntax.SwitchStatement,
  discriminant: Expression,
  cases: [ SwitchCase ],
  lexical: expect(boolean).default(false)
});

// #

var ComprehensionBlock = describe(Node, {
  type: syntax.ComprehensionBlock,
  left: Pattern,
  right: Expression,
  each: expect(boolean).default(false)
});

// #

var YieldExpression = describe(Expression, {
  type: syntax.YieldExpression,
  argument: expect(Expression, null).default(null)
});

// #

var ComprehensionExpression = describe(Expression, {
  type: syntax.ComprehensionExpression,
  body: Expression,
  blocks: [ ComprehensionBlock ],
  filter: expect(Expression, null).default(null)
});

// #

var TryStatement = describe(Statement, {
  type: syntax.TryStatement,
  block: BlockStatement,
  handler: expect(CatchClause, null).default(null),
  guardedHandlers: [ CatchClause ],
  finalizer: expect(BlockStatement, null).default(null)
});

// #

var LabeledStatement = describe(Statement, {
  type: syntax.LabeledStatement,
  label: Identifier,
  body: Statement
});

// #

var ForOfStatement = describe(Statement, {
  type: syntax.ForOfStatement,
  left: expect(VariableDeclaration, Expression),
  right: Expression,
  body: Statement
});

// #

var WithStatement = describe(Statement, {
  type: syntax.WithStatement,
  object: Expression,
  body: Statement
});

// #

var DebuggerStatement = describe(Statement, {
  type: syntax.DebuggerStatement
});

// #

var ArrowFunctionExpression = describe(Expression, {
  type: syntax.ArrowFunctionExpression,
  params: [ Pattern ],
  defaults: [ Expression, null ],
  rest: expect(Identifier, null).default(null),
  body: expect(BlockStatement, Expression),
  expression: expect(boolean).default(false)
});

// # Function

var Function = types.Function = { test: function(item) {
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
  type: syntax.SpreadElement,
  argument: Expression
});

// var missing = [];

// for (var key in s) if (!(key in nodes)) missing.push(key);
// console.warn('missing', missing);

module.exports = types;

'use strict';

var syntax = require('./syntax.json');

var typeOf = require('./util/type-of');
var factory = require('./lib/factory');

var Node = factory.Node;

// esprima bug: for in does not parse with array / object patterns
// esprima bug: for of (and comprehensions blocks) parse as ArrayExpression / ObjectExpression

// # type checks

var string = { test: typeOf.String };
var boolean = { test: typeOf.Boolean };
var number = { test: typeOf.Number };
var regexp = { test: typeOf.RegExp };
var object = { test: typeOf.Object };

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

// todo: remove this when for of and for in parse patterns correctly
ArrayPattern.pre = function(ast) {
  ast.elements.forEach(function(node) {
    if (node) switch (node.type) {
      case syntax.ArrayExpression: node.type = syntax.ArrayPattern; break;
      case syntax.ObjectExpression: node.type = syntax.ObjectPattern; break;
    }
  });
  return ast;
};

// # Literal

var Literal = describe(Expression, {
  type: syntax.Literal,
  value: expect(string, boolean, null, number, regexp),
  raw: expect(string, null).default(null)
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

// todo: remove this when for of and for in parse patterns correctly
ObjectPattern.pre = function(ast) {
  ast.properties.forEach(function(node) {
    var value = node.value;
    switch (value.type) {
      case syntax.ArrayExpression: value.type = syntax.ArrayPattern; break;
      case syntax.ObjectExpression: value.type = syntax.ObjectPattern; break;
    }
  });

  return ast;
};

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
  property: Expression,
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
  left: expect(Pattern, Expression),
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
  left: expect(VariableDeclaration, Pattern), // this should not have Expression. Mozilla has it. Esprima parses it.
  right: Expression,
  body: Statement,
  each: expect(boolean).default(false)
});

// todo: remove this when for of and for in parse patterns correctly
ForInStatement.pre = function(ast) {
  var node = ast.left;
  switch (node.type) {
    case syntax.ArrayExpression: node.type = syntax.ArrayPattern; break;
    case syntax.ObjectExpression: node.type = syntax.ObjectPattern; break;
  }
  return ast;
};

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

var ForOfStatement = describe(Statement, {
  type: syntax.ForOfStatement,
  left: expect(VariableDeclaration, Pattern), // this should not have Expression
  right: Expression,
  body: Statement
});

// todo: remove this when forOf / forIn get fixed in esprima
ForOfStatement.pre = ForInStatement.pre;

// #

var ComprehensionBlock = describe(Node, {
  type: syntax.ComprehensionBlock,
  left: Pattern, // this should not have Expression, esprima parses it wrong.
  right: Expression,
  each: expect(boolean).default(false),
  of: expect(boolean).default(true)
});

ComprehensionBlock.pre = ForOfStatement.pre;

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
  handlers: [ CatchClause ],
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

// # Classes

var MethodDefinition = describe(Node, {
  type: syntax.MethodDefinition,
  key: Identifier,
  value: FunctionExpression,
  kind: expect(string).default(''),
  static: expect(boolean).default(false)
});

var ClassBody = describe(Expression, {
  type: syntax.ClassBody,
  body: [ MethodDefinition ]
});

var ClassDeclaration = describe(Declaration, {
  type: syntax.ClassDeclaration,
  id: Identifier,
  superClass: expect(Expression, null).default(null),
  body: ClassBody
});

var ClassExpression = describe(Expression, {
  type: syntax.ClassExpression,
  id: Identifier,
  superClass: expect(Expression, null).default(null),
  body: ClassBody
});

var Class = types.Class = expect(ClassExpression, ClassDeclaration);

// #

var SpreadElement = describe(Expression, {
  type: syntax.SpreadElement,
  argument: Expression
});

// #

var TemplateElement = describe(Node, {
  type: syntax.TemplateElement,
  value: object,
  tail: boolean
});

var TemplateLiteral = describe(Expression, {
  type: syntax.TemplateLiteral,
  quasis: [ TemplateElement ],
  expressions: [ Expression ]
});

// missing:
// "ExportDeclaration", "ExportBatchSpecifier", "ExportSpecifier",
// "ImportDeclaration", "ImportSpecifier", "ModuleDeclaration",
// "TaggedTemplateExpression", "TemplateElement", "TemplateLiteral"

module.exports = types;
